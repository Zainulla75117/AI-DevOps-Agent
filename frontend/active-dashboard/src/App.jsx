import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react';

const LoginPage = lazy(() => import('./components/LoginPage'));
const RegistrationPage = lazy(() => import('./components/RegistrationPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const InfrastructurePage = lazy(() => import('./pages/InfrastructurePage'));
const AutomationPage = lazy(() => import('./pages/AutomationPage'));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

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
  <Suspense fallback={<div>Loading...</div>}>
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
      <Route path="/" element={<Navigate to="/home" replace />} />
    </Routes>
  </Suspense>
</Router>
  )
}

export default App

