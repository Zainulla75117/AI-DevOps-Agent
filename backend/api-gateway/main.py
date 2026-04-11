"""
InfraX API Gateway
==================
Central entry point for all frontend requests.
Handles: CORS, Payload Decryption, JWT Verification, Reverse Proxy Routing.

The frontend only talks to this gateway (port 8000).
Downstream microservices are never exposed directly.
"""

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
import json
from jose import JWTError, jwt

from config import settings, ROUTE_MAP, get_downstream_url, is_public_route
from crypto_service import crypto_service

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG
)

# ─── CORS (centralized, single place for all services) ────────────────────
cors_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Payload Decryption Middleware (ASGI-level) ───────────────────────────
class DecryptPayloadMiddleware:
    """
    Intercepts POST/PUT/PATCH requests. If the body contains an encrypted
    envelope {encrypted_data, encrypted_key, iv}, it decrypts the payload
    before passing it to the downstream proxy handler.
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("method", "") not in ["POST", "PUT", "PATCH"]:
            return await self.app(scope, receive, send)

        # Read the full body from the ASGI stream
        body = b""
        more_body = True
        while more_body:
            message = await receive()
            body += message.get("body", b"")
            more_body = message.get("more_body", False)

        final_body = body
        if body:
            try:
                payload = json.loads(body)
                if isinstance(payload, dict) and all(k in payload for k in ("encrypted_data", "encrypted_key", "iv")):
                    decrypted_dict = crypto_service.decrypt_payload(
                        payload["encrypted_data"],
                        payload["encrypted_key"],
                        payload["iv"]
                    )
                    final_body = json.dumps(decrypted_dict).encode("utf-8")
                    
                    # Update Content-Length header
                    headers = dict(scope.get('headers', []))
                    headers[b'content-length'] = str(len(final_body)).encode()
                    scope['headers'] = [(k, v) for k, v in headers.items()]
            except json.JSONDecodeError:
                pass
            except Exception as e:
                print(f"[GATEWAY] Decryption error: {e}")

        # Re-inject the (possibly decrypted) body back into the ASGI stream
        invoked = False
        async def mock_receive():
            nonlocal invoked
            if invoked:
                return {"type": "http.request", "body": b"", "more_body": False}
            invoked = True
            return {"type": "http.request", "body": final_body, "more_body": False}

        await self.app(scope, mock_receive, send)

app.add_middleware(DecryptPayloadMiddleware)


# ─── Public Key Endpoint (served directly by the gateway) ─────────────────
@app.get("/api/crypto/public-key")
async def get_public_key():
    """Return the gateway's RSA public key for frontend encryption."""
    return {"public_key": crypto_service.get_public_key_pem()}


# ─── Health Check ─────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "message": "InfraX API Gateway",
        "docs": "/docs",
        "health": "/api/health"
    }

@app.get("/api/health")
async def health():
    """Gateway health check — pings downstream services."""
    results = {}
    async with httpx.AsyncClient(timeout=5.0) as client:
        for name, url in [
            ("auth", settings.AUTH_SERVICE_URL),
            ("project", settings.PROJECT_SERVICE_URL),
            ("credential", settings.CREDENTIAL_SERVICE_URL),
        ]:
            try:
                r = await client.get(f"{url}/api/health")
                results[name] = "healthy" if r.status_code == 200 else f"status {r.status_code}"
            except Exception:
                results[name] = "unreachable"
    
    overall = "healthy" if all(v == "healthy" for v in results.values()) else "degraded"
    return {"status": overall, "services": results}


# ─── JWT Verification Helper ─────────────────────────────────────────────
def verify_jwt(token: str) -> dict | None:
    """Decode and verify a JWT token. Returns payload or None."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


# ─── Reverse Proxy (catch-all route) ──────────────────────────────────────
@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy(request: Request, path: str):
    """
    Catch-all reverse proxy handler.
    1. Resolves the downstream service from the URL prefix.
    2. Checks JWT for protected routes.
    3. Forwards the request (headers + body) to the downstream service.
    4. Returns the downstream response to the client.
    """
    full_path = f"/{path}"
    
    # 1. Resolve downstream service
    downstream_url = get_downstream_url(full_path)
    if not downstream_url:
        return JSONResponse(
            status_code=404,
            content={"detail": f"No service registered for path: {full_path}"}
        )
    
    # 2. JWT Verification for protected routes
    if not is_public_route(full_path):
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid Authorization header"}
            )
        token = auth_header.split(" ", 1)[1]
        payload = verify_jwt(token)
        if payload is None:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired token"}
            )
    
    # 3. Build downstream request
    target_url = f"{downstream_url}{full_path}"
    
    # Append query string if present
    if request.url.query:
        target_url += f"?{request.url.query}"
    
    # Forward headers (exclude host)
    headers = dict(request.headers)
    headers.pop("host", None)
    
    # Read body
    body = await request.body()
    
    # 4. Proxy the request
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
            )
        
        # 5. Return downstream response
        # Filter out hop-by-hop headers
        excluded_headers = {"transfer-encoding", "content-encoding", "connection"}
        response_headers = {
            k: v for k, v in response.headers.items()
            if k.lower() not in excluded_headers
        }
        
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=response_headers,
        )
    except httpx.ConnectError:
        return JSONResponse(
            status_code=502,
            content={"detail": f"Cannot connect to downstream service at {downstream_url}"}
        )
    except httpx.TimeoutException:
        return JSONResponse(
            status_code=504,
            content={"detail": "Downstream service timed out"}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Gateway error: {str(e)}"}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
