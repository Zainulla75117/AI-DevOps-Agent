# DevOps Agent - Frontend

A modern, animated login page for the DevOps Agent application built with Vite, React, and Tailwind CSS.

## Features

- 🎨 **Asymmetric Design**: Beautiful split-screen layout with logo on left, form on right
- ♾️ **Animated Infinity Logo**: Custom SVG infinity symbol with smooth animations
- 🎭 **DevOps Theme**: Dark theme with blue/purple gradient accents
- 🔐 **JWT Authentication**: Integrated login with JWT token handling
- ✨ **Smooth Animations**: Multiple Tailwind CSS animations for a polished UX
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Tailwind CSS**: Modern utility-first CSS framework for rapid UI development

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Update the `.env` file with your backend API URL:
```
VITE_API_BASE_URL=http://your-backend-url:port
```

### Development

Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## API Integration

The login form sends a POST request to `/api/login` with the following payload:
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

Expected response:
```json
{
  "token": "jwt_token_here"
}
```

The JWT token is automatically stored in `localStorage` upon successful login.

## Project Structure

```
src/
├── components/
│   ├── LoginPage.jsx       # Main login page component (Tailwind styled)
│   ├── LoginForm.jsx       # Login form component (Tailwind styled)
│   └── InfinityLogo.jsx    # Animated infinity logo (Tailwind styled)
├── services/
│   └── authService.js      # Authentication API service
├── App.jsx                 # Root component
├── main.jsx                # Entry point
└── index.css               # Global styles with Tailwind directives
```

## Customization

### Backend URL
Update `VITE_API_BASE_URL` in your `.env` file to point to your backend API.

### Colors & Theme
Modify the Tailwind color classes in the components or extend the theme in `tailwind.config.js` to match your brand. The current theme uses:
- Blue: `#3b82f6`
- Purple: `#8b5cf6`
- Cyan: `#06b6d4`

### API Endpoint
If your backend uses a different endpoint, update the `login` function in `src/services/authService.js`.

## License

MIT

