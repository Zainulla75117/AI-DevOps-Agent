# Frontend Form API Specification

This document outlines the exact format the frontend expects for form responses in the chat interface.

## Response Format

The frontend expects responses in the following format:

### 1. Options Menu Response

When the backend wants to show an options menu to the user:

```json
{
  "type": "options",
  "requires_options": true,
  "session_id": "unique-session-id-here",
  "message": "What would you like to do?",
  "options": [
    {
      "id": "build_pipeline",
      "label": "Build/Create Pipeline",
      "description": "Create a new CI/CD pipeline",
      "icon": "🚀"
    },
    {
      "id": "ask_question",
      "label": "Ask Questions",
      "description": "Get help with Jenkins",
      "icon": "❓"
    },
    {
      "id": "view_examples",
      "label": "View Examples",
      "description": "See pipeline examples",
      "icon": "📚"
    }
  ]
}
```

**Note:** Either `type: "options"` OR `requires_options: true` must be present.

### 2. Form Response

When the backend wants to show a form to the user:

```json
{
  "type": "form",
  "requires_form": true,
  "session_id": "unique-session-id-here",
  "message": "Please fill in the pipeline details:",
  "form": {
    "title": "Pipeline Configuration",
    "description": "Configure your CI/CD pipeline settings",
    "fields": [
      {
        "name": "app_type",
        "label": "Application Type",
        "type": "select",
        "required": true,
        "default_value": "",
        "placeholder": "Select application type",
        "help_text": "Choose the type of application you're building",
        "options": [
          {
            "value": "Frontend (FE)",
            "label": "Frontend (FE)"
          },
          {
            "value": "Backend (BE)",
            "label": "Backend (BE)"
          },
          {
            "value": "Fullstack",
            "label": "Fullstack"
          }
        ]
      },
      {
        "name": "framework",
        "label": "Framework",
        "type": "select",
        "required": true,
        "default_value": "",
        "placeholder": "Select framework",
        "help_text": "Choose your application framework",
        "show_if": {
          "field": "app_type",
          "operator": "in",
          "values": ["Frontend (FE)", "Fullstack"]
        },
        "options": [
          {
            "value": "react",
            "label": "React"
          },
          {
            "value": "vue",
            "label": "Vue.js"
          },
          {
            "value": "angular",
            "label": "Angular"
          }
        ]
      },
      {
        "name": "project_name",
        "label": "Project Name",
        "type": "text",
        "required": true,
        "default_value": "",
        "placeholder": "Enter project name",
        "help_text": "The name of your project"
      },
      {
        "name": "repository_url",
        "label": "Repository URL",
        "type": "text",
        "required": true,
        "default_value": "",
        "placeholder": "https://github.com/user/repo",
        "help_text": "Git repository URL"
      }
    ]
  }
}
```

**Note:** Either `type: "form"` OR `requires_form: true` must be present.

### 3. Regular Text Response

For normal chat messages:

```json
{
  "type": "text",
  "session_id": "unique-session-id-here",
  "response": "Your pipeline has been created successfully!",
  "message": "Your pipeline has been created successfully!",
  "content": "Your pipeline has been created successfully!"
}
```

## Field Types

### Select Field (Dropdown)

```json
{
  "name": "field_name",
  "label": "Field Label",
  "type": "select",
  "required": true,
  "default_value": "",
  "options": [
    {
      "value": "option1",
      "label": "Option 1 Display Name"
    },
    {
      "value": "option2",
      "label": "Option 2 Display Name"
    }
  ]
}
```

### Text Field (Input)

```json
{
  "name": "field_name",
  "label": "Field Label",
  "type": "text",
  "required": true,
  "default_value": "",
  "placeholder": "Enter value here",
  "help_text": "Additional help text"
}
```

## Conditional Fields (show_if)

Fields can be conditionally shown based on other field values:

```json
{
  "name": "framework",
  "label": "Framework",
  "type": "select",
  "show_if": {
    "field": "app_type",
    "operator": "in",
    "values": ["Frontend (FE)", "Fullstack"]
  }
}
```

### Supported Operators

1. **equals**: Field value must equal the specified value
   ```json
   {
     "field": "app_type",
     "operator": "equals",
     "value": "Frontend (FE)"
   }
   ```

2. **in**: Field value must be in the specified array
   ```json
   {
     "field": "app_type",
     "operator": "in",
     "values": ["Frontend (FE)", "Fullstack"]
   }
   ```

3. **not_equals**: Field value must not equal the specified value
   ```json
   {
     "field": "app_type",
     "operator": "not_equals",
     "value": "Backend (BE)"
   }
   ```

## Form Submission

When user submits the form, frontend sends:

```json
{
  "query": "submit",
  "session_id": "unique-session-id-from-response",
  "is_form_submission": true,
  "form_data": {
    "app_type": "Frontend (FE)",
    "framework": "react",
    "project_name": "my-project",
    "repository_url": "https://github.com/user/repo"
  }
}
```

## Option Selection

When user selects an option, frontend sends:

```json
{
  "query": "build_pipeline",
  "session_id": "unique-session-id-from-response",
  "is_option_selection": true
}
```

## SSE Streaming Format

For Server-Sent Events (SSE), the backend should send:

### Form in SSE Stream

```json
{
  "type": "form",
  "requires_form": true,
  "session_id": "unique-session-id",
  "message": "Please fill in the details:",
  "form": {
    "title": "Pipeline Configuration",
    "description": "Configure your pipeline",
    "fields": [...]
  }
}
```

### Options in SSE Stream

```json
{
  "type": "options",
  "requires_options": true,
  "session_id": "unique-session-id",
  "message": "What would you like to do?",
  "options": [...]
}
```

### Text Chunk in SSE Stream

```json
{
  "type": "chunk",
  "content": "This is a text chunk"
}
```

### Stream Complete

```json
{
  "type": "done",
  "content": "Final message content"
}
```

## Important Notes

1. **Session ID**: Always include `session_id` in responses. Frontend will preserve and reuse it.

2. **Type Detection**: Frontend checks for:
   - `type === "form"` OR `requires_form === true` for forms
   - `type === "options"` OR `requires_options === true` for options menu
   - `type === "text"` or default for regular messages

3. **Form Structure**: The `form` object must contain:
   - `title` (optional): Form title
   - `description` (optional): Form description
   - `fields` (required): Array of field objects

4. **Field Requirements**: Each field must have:
   - `name`: Unique field identifier
   - `label`: Display label
   - `type`: Either "select" or "text"
   - `required`: Boolean indicating if field is required

5. **Conditional Logic**: Fields with `show_if` will only be visible when the condition is met.

## Example Complete Flow

1. **User asks**: "I want to build a pipeline"

2. **Backend responds with options**:
   ```json
   {
     "type": "options",
     "requires_options": true,
     "session_id": "session-123",
     "options": [
       {"id": "build_pipeline", "label": "Build Pipeline", ...}
     ]
   }
   ```

3. **User selects option**: Frontend sends `{"query": "build_pipeline", "is_option_selection": true, ...}`

4. **Backend responds with form**:
   ```json
   {
     "type": "form",
     "requires_form": true,
     "session_id": "session-123",
     "form": {
       "fields": [...]
     }
   }
   ```

5. **User fills and submits form**: Frontend sends `{"query": "submit", "is_form_submission": true, "form_data": {...}}`

6. **Backend responds with result**:
   ```json
   {
     "type": "text",
     "session_id": "session-123",
     "response": "Pipeline created successfully!"
   }
   ```

