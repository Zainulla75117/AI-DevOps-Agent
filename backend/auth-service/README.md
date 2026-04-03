# DevOps POC Backend

A FastAPI backend application with MongoDB database, organized in a modular structure.

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── config.py              # Application configuration and settings
│   ├── database/
│   │   ├── __init__.py
│   │   └── connection.py      # MongoDB connection and database setup
│   ├── models/
│   │   ├── __init__.py
│   │   └── user.py            # MongoDB document models
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── user.py            # Pydantic schemas for request/response validation
│   ├── crud/
│   │   ├── __init__.py
│   │   └── user.py            # CRUD operations for users
│   └── routers/
│       ├── __init__.py
│       └── user.py            # API route handlers for users
├── main.py                     # FastAPI application entry point
├── requirements.txt            # Python dependencies
└── README.md                   # This file
```

## Features

- **Modular Architecture**: Clean separation of concerns with dedicated folders for models, schemas, CRUD operations, and routers
- **MongoDB Integration**: Uses Motor (async MongoDB driver) for database operations
- **FastAPI**: Modern, fast web framework for building APIs
- **Type Safety**: Pydantic models for request/response validation
- **Async/Await**: Fully asynchronous database operations

## Setup

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   MONGODB_URL=mongodb://localhost:27017
   DATABASE_NAME=devops_poc
   DEBUG=False
   APP_NAME=DevOps POC Backend
   ```

3. **Start MongoDB**
   Make sure MongoDB is running on your system or update `MONGODB_URL` to point to your MongoDB instance.

4. **Run the Application**
   ```bash
   uvicorn main:app --reload
   ```

   The API will be available at `http://localhost:8000`
   API documentation: `http://localhost:8000/docs`

## API Endpoints

### User Endpoints

- `POST /users/register` - Register a new user
- `POST /users/login` - Login a user
- `GET /users` - Get all users (with pagination)
- `GET /users/{user_id}` - Get a specific user by ID
- `PUT /users/{user_id}` - Update a user
- `DELETE /users/{user_id}` - Delete a user

### Health Check

- `GET /` - Root endpoint
- `GET /health` - Health check endpoint

## Database Schema

### User Model
- `_id`: ObjectId (auto-generated)
- `username`: String (unique, required)
- `password`: String (required)
- `email`: String (optional, unique)
- `is_active`: Boolean (default: true)
- `created_at`: DateTime (auto-generated)
- `updated_at`: DateTime (auto-updated)

## Development

The project follows a modular structure:

- **Models** (`app/models/`): MongoDB document models using Pydantic
- **Schemas** (`app/schemas/`): Pydantic schemas for API request/response validation
- **CRUD** (`app/crud/`): Database operations (Create, Read, Update, Delete)
- **Routers** (`app/routers/`): API route handlers
- **Database** (`app/database/`): Database connection and configuration

