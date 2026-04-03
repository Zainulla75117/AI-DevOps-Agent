# Server-Sent Events (SSE) Implementation Prompt for Jenkins Chat Backend

## Overview
Implement a Server-Sent Events (SSE) endpoint for streaming chat responses in the Jenkins Agent chat interface. The system should support both streaming (SSE) and non-streaming (regular POST) requests.

---

## 1. SSE Streaming Endpoint

### Endpoint Specification
- **URL:** `GET /api/jenkins/chat/stream`
- **Method:** GET
- **Content-Type:** `text/event-stream`
- **Authentication:** JWT token (via query parameter `token` or Authorization header if supported)

### Request Parameters (Query String)
```
GET /api/jenkins/chat/stream?message={userMessage}&session_id={sessionId}&token={jwtToken}
```

**Parameters:**
- `message` (required): The user's message/query (URL encoded)
- `session_id` (optional): Chat session identifier. If not provided, generate new: `jenkins-chat-{timestamp}`
- `token` (optional): JWT authentication token. Also check Authorization header: `Bearer {token}`

### Response Format (SSE Events)

The endpoint should stream events in SSE format. Each event should be a JSON object with the following structure:

#### Streaming Chunks (During Response Generation)
```json
{
  "type": "chunk",
  "content": "partial text content..."
}
```
- Send multiple `chunk` events as the response is generated
- Each chunk contains a portion of the response text
- Accumulate all chunks on the frontend to build the complete message

#### Final/Complete Message
```json
{
  "type": "done",
  "content": "complete response text",
  "response_type": "text|form|options",
  "session_id": "jenkins-chat-1234567890",
  "form": { ... },           // Only if response_type is "form"
  "options": [ ... ],         // Only if response_type is "options"
  "requires_form": true/false // Boolean flag
}
```

**Response Type Values:**
- `"text"`: Regular text response
- `"form"`: Response requires a form (include `form` object)
- `"options"`: Response requires user to select from options (include `options` array)

#### Error Event
```json
{
  "type": "error",
  "message": "Error description"
}
```

### SSE Event Format
Each event should follow SSE protocol:
```
data: {"type":"chunk","content":"Hello"}
\n\n
data: {"type":"chunk","content":" World"}
\n\n
data: {"type":"done","content":"Hello World","response_type":"text"}
\n\n
```

---

## 2. Regular Chat Endpoint (Non-Streaming Fallback)

### Endpoint Specification
- **URL:** `POST /api/jenkins/chat`
- **Method:** POST
- **Content-Type:** `application/json`
- **Authentication:** JWT token via `Authorization: Bearer {token}` header

### Request Body
```json
{
  "message": "user message text",
  "session_id": "jenkins-chat-1234567890",
  "has_form_data": false,
  "form_data": null
}
```

**With Form Data:**
```json
{
  "message": "user message text",
  "session_id": "jenkins-chat-1234567890",
  "has_form_data": true,
  "form_data": {
    "repo_url": "https://gitlab.example.com/namespace/repo.git",
    "branch": "master/main",
    "output_filename": "namespace/repo"
  }
}
```

### Response Body
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

---

## 3. Form Submission Endpoint

### Endpoint Specification
- **URL:** `POST /api/jenkins/chat`
- **Method:** POST
- **Content-Type:** `application/json`
- **Authentication:** JWT token via `Authorization: Bearer {token}` header

### Request Body
```json
{
  "query": "submit",
  "session_id": "jenkins-chat-1234567890",
  "is_form_submission": true,
  "form_data": {
    "repo_url": "https://gitlab.example.com/namespace/repo.git",
    "branch": "master/main",
    "output_filename": "namespace/repo"
  }
}
```

**Form Data Fields:**
- `repo_url` (string): HTTP URL to the repository (e.g., `https://gitlab.example.com/namespace/repo.git`)
- `branch` (string): Branch name (default: `"master/main"`)
- `output_filename` (string): Path with namespace (e.g., `"namespace/repo"`)

### Response Body
```json
{
  "session_id": "jenkins-chat-1234567890",
  "type": "text|form|options",
  "response": "Form submitted successfully. Processing...",
  "message": "alternative response field",
  "content": "another alternative response field",
  "form": { ... },           // If another form is needed
  "options": [ ... ],        // If options are needed
  "requires_form": true/false,
  "requires_options": true/false
}
```

---

## 4. Form Structure (When response_type is "form")

When the backend needs to collect information via a form, return a `form` object with this structure:

```json
{
  "form": {
    "fields": [
      {
        "name": "source_type",
        "label": "Source Type",
        "type": "select",
        "required": true,
        "show_if": null
      },
      {
        "name": "scm_cred_id",
        "label": "SCM Credentials",
        "type": "select",
        "required": false,
        "show_if": {
          "field": "source_type",
          "value": "SCM"
        }
      },
      {
        "name": "repo_namespace",
        "label": "Repository Namespace",
        "type": "select",
        "required": false,
        "show_if": {
          "field": "source_type",
          "value": "SCM"
        }
      },
      {
        "name": "repo_name",
        "label": "Repository Name",
        "type": "text",
        "required": false,
        "placeholder": "Search repositories...",
        "show_if": {
          "field": "source_type",
          "value": "SCM"
        }
      },
      {
        "name": "branch",
        "label": "Branch",
        "type": "text",
        "required": false,
        "placeholder": "master/main",
        "show_if": {
          "field": "source_type",
          "value": "SCM"
        }
      },
      {
        "name": "stack_details",
        "label": "Stack Details",
        "type": "textarea",
        "required": false,
        "placeholder": "Enter stack details (e.g., Node.js, Python, Java, etc.)",
        "show_if": {
          "field": "source_type",
          "value": "Manual"
        }
      }
    ],
    "submit_button_text": "Generate Pipeline"
  }
}
```

**Field Types:**
- `"text"`: Text input
- `"textarea"`: Multi-line text input
- `"select"`: Dropdown select

**Conditional Fields (`show_if`):**
- Fields with `show_if` are only visible when the condition is met
- `show_if.field`: Name of the field to check
- `show_if.value`: Value that the field must equal for this field to be visible

---

## 5. Options Structure (When response_type is "options")

When the backend needs user to select from options:

```json
{
  "options": [
    {
      "label": "Option 1 Label",
      "value": "option1_value"
    },
    {
      "label": "Option 2 Label",
      "value": "option2_value"
    }
  ]
}
```

---

## 6. Session Management

- **Session ID Format:** `jenkins-chat-{timestamp}` (e.g., `jenkins-chat-1703123456789`)
- **Session Persistence:** Maintain conversation context within a session
- **New Session:** Generate new session ID if not provided in request
- **Session Return:** Always return `session_id` in response (for SSE, include in `done` event)

---

## 7. Error Handling

### Authentication Errors
- Return HTTP 401 if token is invalid or missing
- For SSE, send error event: `{"type": "error", "message": "Unauthorized"}`

### Validation Errors
- Return HTTP 400 for invalid request data
- Include error details in response body

### Server Errors
- Return HTTP 500 for internal server errors
- For SSE, send error event: `{"type": "error", "message": "Internal server error"}`

---

## 8. Implementation Requirements

1. **SSE Support:**
   - Set proper headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
   - Stream chunks as they are generated (don't wait for complete response)
   - Always send a final `done` event to signal completion
   - Handle client disconnections gracefully

2. **CORS:**
   - Allow requests from frontend origin
   - Include appropriate CORS headers for SSE

3. **Authentication:**
   - Validate JWT token on every request
   - Extract user information from token for session management

4. **Response Generation:**
   - Use LLM/chat model to generate responses
   - Support streaming for real-time user experience
   - Detect when form or options are needed based on conversation context

5. **Form Data Processing:**
   - When `is_form_submission: true`, process the form data
   - Extract `repo_url`, `branch`, and `output_filename` from `form_data`
   - Use this data to generate Jenkins pipeline or perform actions

---

## 9. Example Implementation Flow

### SSE Request Flow:
1. Client sends: `GET /api/jenkins/chat/stream?message=Build%20pipeline&session_id=jenkins-chat-123&token=xyz`
2. Backend validates token and session
3. Backend starts generating response
4. Backend streams chunks: `data: {"type":"chunk","content":"I'll help"}`
5. Backend continues streaming: `data: {"type":"chunk","content":" you build"}`
6. Backend sends final: `data: {"type":"done","content":"I'll help you build a pipeline","response_type":"form","form":{...}}`
7. Backend closes connection

### Form Submission Flow:
1. Client sends: `POST /api/jenkins/chat` with form data
2. Backend processes form data (repo_url, branch, output_filename)
3. Backend generates Jenkins pipeline or performs action
4. Backend returns response with next steps or confirmation

---

## 10. Testing Checklist

- [ ] SSE endpoint streams chunks correctly
- [ ] SSE endpoint sends final `done` event
- [ ] SSE endpoint handles errors gracefully
- [ ] Regular POST endpoint works as fallback
- [ ] Form submission processes data correctly
- [ ] Session management works across requests
- [ ] Authentication is validated on all endpoints
- [ ] CORS headers are set correctly
- [ ] Form structure is returned correctly
- [ ] Options structure is returned correctly

---

## Notes for Implementation

- The frontend will fallback to regular POST if SSE fails
- Always include `session_id` in responses to maintain conversation context
- Support multiple response fields (`response`, `message`, `content`) for flexibility
- Form fields with `show_if` should be conditionally rendered on frontend
- The `output_filename` should match the repository's `path_with_namespace` format

