# Form API - Quick Reference Examples

Quick copy-paste examples for backend implementation.

## Example 1: Simple Options Menu

```json
{
  "type": "options",
  "requires_options": true,
  "session_id": "chat-session-12345",
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
    }
  ]
}
```

## Example 2: Simple Form (No Conditionals)

```json
{
  "type": "form",
  "requires_form": true,
  "session_id": "chat-session-12345",
  "message": "Please provide the following information:",
  "form": {
    "title": "Pipeline Configuration",
    "description": "Configure your CI/CD pipeline",
    "fields": [
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

## Example 3: Form with Conditional Fields

```json
{
  "type": "form",
  "requires_form": true,
  "session_id": "chat-session-12345",
  "message": "Configure your pipeline:",
  "form": {
    "title": "Pipeline Configuration",
    "fields": [
      {
        "name": "app_type",
        "label": "Application Type",
        "type": "select",
        "required": true,
        "default_value": "",
        "options": [
          {"value": "Frontend (FE)", "label": "Frontend (FE)"},
          {"value": "Backend (BE)", "label": "Backend (BE)"},
          {"value": "Fullstack", "label": "Fullstack"}
        ]
      },
      {
        "name": "framework",
        "label": "Framework",
        "type": "select",
        "required": true,
        "default_value": "",
        "show_if": {
          "field": "app_type",
          "operator": "in",
          "values": ["Frontend (FE)", "Fullstack"]
        },
        "options": [
          {"value": "react", "label": "React"},
          {"value": "vue", "label": "Vue.js"},
          {"value": "angular", "label": "Angular"}
        ]
      },
      {
        "name": "backend_framework",
        "label": "Backend Framework",
        "type": "select",
        "required": true,
        "default_value": "",
        "show_if": {
          "field": "app_type",
          "operator": "in",
          "values": ["Backend (BE)", "Fullstack"]
        },
        "options": [
          {"value": "spring", "label": "Spring Boot"},
          {"value": "django", "label": "Django"},
          {"value": "express", "label": "Express.js"}
        ]
      }
    ]
  }
}
```

## Example 4: SSE Stream Response (Form)

For SSE streaming, send this as a single event:

```json
{
  "type": "form",
  "requires_form": true,
  "session_id": "chat-session-12345",
  "message": "Fill in the form:",
  "form": {
    "title": "Pipeline Setup",
    "fields": [
      {
        "name": "project_name",
        "label": "Project Name",
        "type": "text",
        "required": true,
        "default_value": ""
      }
    ]
  }
}
```

## Example 5: SSE Stream Response (Options)

```json
{
  "type": "options",
  "requires_options": true,
  "session_id": "chat-session-12345",
  "message": "Choose an option:",
  "options": [
    {
      "id": "build_pipeline",
      "label": "Build Pipeline",
      "description": "Create a new pipeline"
    }
  ]
}
```

## Expected Form Submission Payload

When user submits form, backend will receive:

```json
{
  "query": "submit",
  "session_id": "chat-session-12345",
  "is_form_submission": true,
  "form_data": {
    "app_type": "Frontend (FE)",
    "framework": "react",
    "project_name": "my-awesome-project",
    "repository_url": "https://github.com/user/repo"
  }
}
```

## Expected Option Selection Payload

When user selects an option, backend will receive:

```json
{
  "query": "build_pipeline",
  "session_id": "chat-session-12345",
  "is_option_selection": true
}
```

## Minimal Required Fields

### For Options Menu:
- `type: "options"` OR `requires_options: true`
- `options` array with at least `id` and `label`

### For Form:
- `type: "form"` OR `requires_form: true`
- `form` object with `fields` array
- Each field needs: `name`, `label`, `type`, `required`

## Field Type Options

**Text Field:**
```json
{
  "name": "field_name",
  "label": "Field Label",
  "type": "text",
  "required": true
}
```

**Select Field:**
```json
{
  "name": "field_name",
  "label": "Field Label",
  "type": "select",
  "required": true,
  "options": [
    {"value": "val1", "label": "Label 1"},
    {"value": "val2", "label": "Label 2"}
  ]
}
```

## Conditional Field Operators

**Show if equals:**
```json
"show_if": {
  "field": "app_type",
  "operator": "equals",
  "value": "Frontend (FE)"
}
```

**Show if in array:**
```json
"show_if": {
  "field": "app_type",
  "operator": "in",
  "values": ["Frontend (FE)", "Fullstack"]
}
```

**Show if not equals:**
```json
"show_if": {
  "field": "app_type",
  "operator": "not_equals",
  "value": "Backend (BE)"
}
```

