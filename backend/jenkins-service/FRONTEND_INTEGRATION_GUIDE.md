# Frontend Integration Guide - Jenkins Chat API

## Overview
This guide provides complete integration instructions for the Jenkins Chat API with Server-Sent Events (SSE) support. The API uses **chat tokens** (separate from login tokens) for authentication.

---

## 🔐 Authentication Flow

### Step 1: Exchange Login Token for Chat Token

**Endpoint:** `POST /api/jenkins/auth/token`

**Request:**
```json
{
  "token": "your_login_jwt_token"
}
```

**Response:**
```json
{
  "chat_token": "llm_chat_jwt_token",
  "expires_in": 3600
}
```

**Example:**
```javascript
async function getChatToken(loginToken) {
  const response = await fetch('http://localhost:8081/api/jenkins/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token: loginToken
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to get chat token');
  }
  
  const data = await response.json();
  return data.chat_token;
}
```

**Important:** 
- Chat tokens expire in 1 hour (3600 seconds)
- Store the chat token and refresh it before expiration
- Chat tokens are **different** from login tokens and are only valid for chat API endpoints

---

## 💬 SSE Chat Streaming (Recommended)

### Endpoint: `GET /api/jenkins/chat/stream`

**Request Format:**
- **Method:** `GET`
- **Endpoint:** `/api/jenkins/chat/stream`
- **Payload:** URL query parameters (EventSource only supports GET requests, no JSON body)

**URL Format:**
```
GET http://localhost:8081/api/jenkins/chat/stream?message={userMessage}&session_id={sessionId}&token={chatToken}
```

**Query Parameters:**
- `message` (required): User's message/query (URL encoded)
  - Example: `message=Build%20pipeline`
- `session_id` (optional): Chat session identifier
  - Format: `jenkins-chat-{timestamp}`
  - Example: `session_id=jenkins-chat-1703123456789`
  - Generated automatically if not provided
- `token` (required): Chat token (JWT, not login token)
  - Example: `token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - Must use chat token from token exchange endpoint

**Important Notes:**
- **No request body** - EventSource doesn't support POST or request bodies
- **Token in query parameter** - Required because EventSource can't send custom headers
- **URL encoding** - Parameters are automatically URL encoded by `URLSearchParams`
- **Chat token required** - Must use chat token (from token exchange), not login token

**Headers:**
EventSource sends standard GET request headers:
- `Accept: text/event-stream`
- `Cache-Control: no-cache`
- Standard browser headers
- **No custom headers** (including Authorization) can be sent with EventSource

### Implementation Example:

```javascript
class ChatSSE {
  constructor(chatToken) {
    this.chatToken = chatToken;
    this.sessionId = null;
    this.eventSource = null;
  }

  sendMessage(message) {
    // Close existing connection if any
    if (this.eventSource) {
      this.eventSource.close();
    }

    // Build query parameters (EventSource uses GET with query params)
    const params = new URLSearchParams({
      message: message,           // User's message (required)
    });
    
    if (this.sessionId) {
      params.append('session_id', this.sessionId);  // Session ID (optional)
    }
    
    if (this.chatToken) {
      params.append('token', this.chatToken);  // Chat token (required)
    }

    // Build SSE URL
    const sseUrl = `http://localhost:8081/api/jenkins/chat/stream?${params.toString()}`;
    
    // Create EventSource (GET request with query params)
    // Note: EventSource automatically handles URL encoding
    this.eventSource = new EventSource(sseUrl);

    // Handle incoming chunks
    this.eventSource.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'chunk') {
        // Stream chunk - append to UI
        this.onChunk(data.content);
      } else if (data.type === 'done') {
        // Complete response
        this.onComplete(data);
        this.sessionId = data.session_id; // Save session ID for next message
        this.eventSource.close();
      } else if (data.type === 'error') {
        // Error occurred
        this.onError(data.message);
        this.eventSource.close();
      }
    });

    // Handle connection errors
    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      this.onError('Connection error');
      this.eventSource.close();
    };
  }

  onChunk(content) {
    // Append chunk to chat UI
    console.log('Chunk:', content);
    // Update your UI here
  }

  onComplete(data) {
    // Handle complete response
    console.log('Complete:', data);
    // Update your UI with final response
  }

  onError(message) {
    // Handle error
    console.error('Error:', message);
    // Show error in UI
  }

  close() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

// Usage
const chatToken = await getChatToken(loginToken);
const chat = new ChatSSE(chatToken);
chat.sendMessage("Hello, how can you help me?");
```

### SSE Event Format:

**Chunk Event (during streaming):**
```json
{
  "type": "chunk",
  "content": "partial text..."
}
```

**Done Event (final response):**
```json
{
  "type": "done",
  "content": "complete response text",
  "response_type": "text|form|options",
  "session_id": "jenkins-chat-1234567890",
  "form": { ... },           // Only if response_type is "form"
  "options": [ ... ],         // Only if response_type is "options"
  "requires_form": true/false
}
```

**Error Event:**
```json
{
  "type": "error",
  "message": "Error description"
}
```

---

## 📝 Regular POST Chat (Fallback)

### Endpoint: `POST /api/jenkins/chat`

**Request:**
```json
{
  "message": "user message text",
  "session_id": "jenkins-chat-1234567890",
  "has_form_data": false,
  "form_data": null
}
```

**Headers:**
```
Authorization: Bearer {chat_token}
Content-Type: application/json
```

**Response:**
```json
{
  "session_id": "jenkins-chat-1234567890",
  "type": "text|form|options",
  "response": "response text",
  "message": "alternative response field",
  "content": "another alternative response field",
  "form": { ... },           // Only if type is "form"
  "options": [ ... ],        // Only if type is "options"
  "requires_form": true/false,
  "requires_options": true/false
}
```

**Example:**
```javascript
async function sendChatMessage(message, sessionId, chatToken) {
  const response = await fetch('http://localhost:8081/api/jenkins/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${chatToken}`
    },
    body: JSON.stringify({
      message: message,
      session_id: sessionId
    })
  });

  if (!response.ok) {
    throw new Error('Chat request failed');
  }

  return await response.json();
}
```

---

## 📋 Form Submission (SCM Repository Analysis)

### When to Use:
When the backend returns a form with `response_type: "form"` and the user submits repository information.

### Request Format:
```json
{
  "query": "submit",
  "session_id": "jenkins-chat-1234567890",
  "is_form_submission": true,
  "form_data": {
    "repo_url": "http_url_to_repo_from_BE_response",
    "branch": "master/main",
    "output_filename": "path_with_namespace_from_BE_response"
  }
}
```

### Via SSE:
```
GET /api/jenkins/chat/stream?message=submit&is_form_submission=true&repo_url={url}&branch={branch}&output_filename={filename}&session_id={session_id}&token={chat_token}
```

### Via POST:
```javascript
const response = await fetch('http://localhost:8081/api/jenkins/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${chatToken}`
  },
  body: JSON.stringify({
    query: "submit",
    session_id: sessionId,
    is_form_submission: true,
    form_data: {
      repo_url: "https://ideyalabs.gitlab.com/username/repo.git",
      branch: "master/main",
      output_filename: "username/repo"
    }
  })
});
```

**Response:** The backend will download the repository, analyze the tech stack, and stream the analysis results back via SSE.

---

## 🔄 Session Management

### Session ID Format:
- Format: `jenkins-chat-{timestamp}`
- Example: `jenkins-chat-1703123456789`
- Generated automatically if not provided

### Session Persistence:
- Conversation history is maintained per session
- Last 20 messages are kept in context
- Session ID is returned in every response
- **Always use the same session_id for a conversation thread**

### Best Practice:
```javascript
// Store session ID after first message
let sessionId = null;

function sendMessage(message) {
  const params = {
    message: message,
    token: chatToken
  };
  
  if (sessionId) {
    params.session_id = sessionId;
  }
  
  // ... send SSE request
  
  // After receiving 'done' event, save sessionId
  // sessionId = data.session_id;
}
```

---

## 🎯 Response Types

### 1. Text Response
```json
{
  "type": "text",
  "content": "Regular text response",
  "response_type": "text"
}
```

### 2. Form Response
```json
{
  "type": "form",
  "content": "Please provide repository details",
  "response_type": "form",
  "form": {
    "fields": [
      {
        "name": "source_type",
        "label": "Source Type",
        "type": "select",
        "required": true
      },
      {
        "name": "repo_url",
        "label": "Repository URL",
        "type": "text",
        "required": false,
        "show_if": {
          "field": "source_type",
          "value": "SCM"
        }
      }
    ],
    "submit_button_text": "Generate Pipeline"
  },
  "requires_form": true
}
```

### 3. Options Response
```json
{
  "type": "options",
  "content": "Please select an option:",
  "response_type": "options",
  "options": [
    {"label": "Option 1", "value": "option1"},
    {"label": "Option 2", "value": "option2"}
  ],
  "requires_options": true
}
```

---

## ⚠️ Error Handling

### Authentication Errors (401)
```json
{
  "type": "error",
  "message": "Unauthorized"
}
```

**Causes:**
- Invalid or expired chat token
- Missing token
- Token type mismatch (using login token instead of chat token)

**Solution:**
- Exchange login token for chat token again
- Check token expiration

### Validation Errors (400)
- Invalid request format
- Missing required fields

### Server Errors (500)
- Internal server error
- LLM service unavailable

---

## 📌 Complete Integration Example

```javascript
class JenkinsChatClient {
  constructor(baseUrl = 'http://localhost:8081', loginToken) {
    this.baseUrl = baseUrl;
    this.loginToken = loginToken;
    this.chatToken = null;
    this.sessionId = null;
    this.tokenExpiry = null;
  }

  // Step 1: Get chat token
  async initialize() {
    try {
      const response = await fetch(`${this.baseUrl}/api/jenkins/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.loginToken })
      });

      if (!response.ok) {
        throw new Error('Failed to get chat token');
      }

      const data = await response.json();
      this.chatToken = data.chat_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);
      
      console.log('Chat token obtained, expires in:', data.expires_in, 'seconds');
      return true;
    } catch (error) {
      console.error('Token exchange failed:', error);
      return false;
    }
  }

  // Step 2: Send message via SSE
  sendMessage(message, onChunk, onComplete, onError) {
    // Check if token needs refresh
    if (Date.now() >= this.tokenExpiry - 60000) { // Refresh 1 min before expiry
      console.log('Token expiring soon, refreshing...');
      this.initialize();
    }

    const params = new URLSearchParams({
      message: message,
      token: this.chatToken
    });

    if (this.sessionId) {
      params.append('session_id', this.sessionId);
    }

    const url = `${this.baseUrl}/api/jenkins/chat/stream?${params.toString()}`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'chunk') {
          onChunk(data.content);
        } else if (data.type === 'done') {
          this.sessionId = data.session_id;
          onComplete(data);
          eventSource.close();
        } else if (data.type === 'error') {
          onError(data.message);
          eventSource.close();
        }
      } catch (e) {
        console.error('Error parsing SSE data:', e);
        onError('Invalid response format');
        eventSource.close();
      }
    });

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      onError('Connection error');
      eventSource.close();
    };

    return eventSource;
  }

  // Step 3: Submit form (for repository analysis)
  submitForm(formData, onChunk, onComplete, onError) {
    const params = new URLSearchParams({
      message: 'submit',
      is_form_submission: 'true',
      repo_url: formData.repo_url,
      branch: formData.branch || 'master/main',
      output_filename: formData.output_filename,
      token: this.chatToken
    });

    if (this.sessionId) {
      params.append('session_id', this.sessionId);
    }

    const url = `${this.baseUrl}/api/jenkins/chat/stream?${params.toString()}`;
    const eventSource = new EventSource(url);

    // Same event handling as sendMessage
    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chunk') {
          onChunk(data.content);
        } else if (data.type === 'done') {
          this.sessionId = data.session_id;
          onComplete(data);
          eventSource.close();
        } else if (data.type === 'error') {
          onError(data.message);
          eventSource.close();
        }
      } catch (e) {
        onError('Invalid response format');
        eventSource.close();
      }
    });

    eventSource.onerror = (error) => {
      onError('Connection error');
      eventSource.close();
    };

    return eventSource;
  }
}

// Usage
const client = new JenkinsChatClient('http://localhost:8081', loginToken);
await client.initialize();

client.sendMessage(
  "Hello",
  (chunk) => console.log('Chunk:', chunk),
  (complete) => console.log('Complete:', complete),
  (error) => console.error('Error:', error)
);
```

---

## 🔧 Configuration

### Base URL
- Development: `http://localhost:8081`
- Production: Update based on your deployment

### Token Management
- Chat tokens expire in 1 hour
- Refresh token 1 minute before expiration
- Store chat token securely (don't expose in logs)

### CORS
- Backend allows all origins in development
- Configure specific origins for production

---

## ✅ Testing Checklist

- [ ] Token exchange endpoint works
- [ ] Chat token is obtained successfully
- [ ] SSE connection establishes
- [ ] Messages are sent and received
- [ ] Session ID is maintained across messages
- [ ] Conversation context is preserved
- [ ] Form submission works
- [ ] Repository analysis streams correctly
- [ ] Error handling works (401, 500, etc.)
- [ ] Token refresh works before expiration

---

## 📞 Support

For issues or questions:
1. Check browser console for errors
2. Verify chat token is valid and not expired
3. Ensure session_id is maintained across requests
4. Check network tab for request/response details

---

## 🎯 Key Points Summary

1. **Use chat tokens, not login tokens** for chat API
2. **Token in query parameter** for SSE (EventSource limitation)
3. **Maintain session_id** for conversation context
4. **Stream responses** via SSE for real-time experience
5. **Handle all event types**: chunk, done, error
6. **Refresh chat token** before expiration

