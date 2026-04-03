import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken, logout, getUserInfo } from '../services/authService'

/**
 * Custom hook for authentication logic
 * Handles token checking, user info fetching, and logout
 */
export const useAuth = () => {
  const navigate = useNavigate()
  const [userInfo, setUserInfo] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      navigate('/login')
      return
    }

    setIsAuthenticated(true)
    const user = getUserInfo()
    if (user) {
      setUserInfo(user)
    }
  }, [navigate])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return {
    userInfo,
    isAuthenticated,
    handleLogout,
  }
}

