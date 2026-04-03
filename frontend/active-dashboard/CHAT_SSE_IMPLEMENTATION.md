# Chat with SSE Streaming - Implementation Guide

## How the Chat Works

### Current Flow (Before SSE)

1. **User Input**: User types a message and clicks send
2. **Frontend**: 
   - Adds user message to state immediately
   - Sets `isLoading = true`
   - Makes API call (currently simulated with `setTimeout`)
3. **Backend**: Processes the request (currently mocked)
4. **Response**: Complete response is returned all at once
5. **Frontend**: Adds assistant message to state, sets `isLoading = false`

### New Flow (With SSE Streaming)

1. **User Input**: User types a message and clicks send
2. **Frontend**:
   - Adds user message to state immediately
   - Sets `isLoading = true`
   - Creates EventSource connection to backend SSE endpoint
3. **Backend**: 
   - Processes the message (e.g., with LLM/API)
   - Streams response chunks via Server-Sent Events (SSE)
   - Sends chunks as they're generated
4. **Frontend**:
   - Receives chunks in real-time via `onmessage` event
   - Updates `streamingMessage` state with accumulated content
   - User sees text appearing word-by-word (like ChatGPT)
   - When stream completes (`type: 'done'`), adds final message to `messages` array
5. **Cleanup**: Closes EventSource connection

## Why SSE is Great for This

✅ **Real-time updates**: Users see responses as they're generated  
✅ **Better UX**: Feels more interactive and responsive  
✅ **Efficient**: No need to wait for complete response  
✅ **Native browser support**: No additional libraries needed  
✅ **Automatic reconnection**: EventSource handles connection issues  

## Backend Implementation (FastAPI Example)

```python
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import json
import asyncio

@app.post("/api/jenkins/chat/stream")
async def stream_chat(request: Request):
    """
    SSE endpoint for streaming Jenkins chat responses
    """
    data = await request.json()
    message = data.get("message")
    session_id = data.get("session_id")
    
    async def generate_response():
        # Your LLM/API call here
        # For example, using OpenAI or your own model
        response_text = "This is a streaming response..."
        
        # Stream chunks
        words = response_text.split()
        for i, word in enumerate(words):
            chunk = {
                "type": "chunk",
                "content": word + " ",
                "session_id": session_id
            }
            yield f"data: {json.dumps(chunk)}\n\n"
            await asyncio.sleep(0.1)  # Simulate processing delay
        
        # Send completion signal
        done = {
            "type": "done",
            "session_id": session_id
        }
        yield f"data: {json.dumps(done)}\n\n"
    
    return StreamingResponse(
        generate_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )
```

## Frontend Implementation Details

### Key Components:

1. **EventSource**: Browser API for receiving SSE streams
2. **streamingMessage State**: Holds accumulated content while streaming
3. **messages State**: Final messages array (user + complete assistant responses)
4. **Cleanup**: Properly closes EventSource on unmount/close

### Data Format:

**Chunk Message:**
```json
{
  "type": "chunk",
  "content": "word ",
  "session_id": "jenkins-chat-1234567890"
}
```

**Done Message:**
```json
{
  "type": "done",
  "session_id": "jenkins-chat-1234567890"
}
```

**Error Message:**
```json
{
  "type": "error",
  "message": "Error description"
}
```

## Important Notes

⚠️ **EventSource Limitation**: EventSource doesn't support custom headers in GET requests. For authentication, you have two options:

### Option 1: EventSource with Query Parameters (Current Implementation)
**Pros**: Simple, native browser API, automatic reconnection  
**Cons**: Less secure (token in URL), GET request only

```javascript
const eventSource = new EventSource(
  `/api/jenkins/chat/stream?token=${token}&message=${message}`
)
```

### Option 2: Fetch + ReadableStream (Recommended for Production)
**Pros**: More secure (token in headers), supports POST, more control  
**Cons**: More code, manual reconnection handling

```javascript
const response = await fetch('/api/jenkins/chat/stream', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ message, session_id })
})

const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  
  const chunk = decoder.decode(value)
  const lines = chunk.split('\n\n')
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6))
      // Handle chunk
    }
  }
}
```

**The current implementation uses Option 1 for simplicity. For production, consider updating to Option 2.**

## Environment Variables

Make sure to set:
```env
VITE_API_BASE_URL=http://localhost:8000
```

## Testing

1. Start your backend with SSE endpoint
2. Open Jenkins chat interface
3. Send a message
4. Watch the response stream in real-time!

