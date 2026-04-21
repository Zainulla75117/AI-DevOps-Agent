import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

import LoginPage from './components/LoginPage';
import RegistrationPage from './components/RegistrationPage';
import HomePage from './pages/HomePage';
import InfrastructurePage from './pages/InfrastructurePage';
import AutomationPage from './pages/AutomationPage';
import MonitoringPage from './pages/MonitoringPage';
import SettingsPage from './pages/SettingsPage';
import GitHubCallbackPage from './pages/GitHubCallbackPage';

import { isAuthenticated } from './services/authService';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  // Check authentication and token expiration
  const authenticated = isAuthenticated()
  return authenticated ? children : <Navigate to="/login" replace />
}

// Public Route Component (redirect to home if already logged in)
const PublicRoute = ({ children }) => {
  return !isAuthenticated() ? children : <Navigate to="/home" replace />
}

function App() {
  return (
    <Router>
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegistrationPage />
          </PublicRoute>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/infrastructure"
        element={
          <ProtectedRoute>
            <InfrastructurePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/automation"
        element={
          <ProtectedRoute>
            <AutomationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/monitoring"
        element={
          <ProtectedRoute>
            <MonitoringPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/auth/github/callback" element={<GitHubCallbackPage />} />
      <Route path="/auth/google/callback" element={<GitHubCallbackPage />} />
      <Route path="/" element={<Navigate to="/home" replace />} />
    </Routes>
</Router>
  )
}

export default App

