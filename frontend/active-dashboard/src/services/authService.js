import axios from 'axios'

// Configure your backend API URL here
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

import { encryptionService } from './encryptionService'

// Add request interceptor for payload encryption
apiClient.interceptors.request.use(
  async (config) => {
    if (['post', 'put', 'patch'].includes(config.method?.toLowerCase()) && config.data) {
      config.data = await encryptionService.encryptPayload(config.data, API_BASE_URL, '/api/crypto/public-key')
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Helper function to clear auth data
const clearAuthData = () => {
  localStorage.removeItem('jwt_token')
  localStorage.removeItem('token_type')
  localStorage.removeItem('user_info')
  localStorage.removeItem('llm_chat_token')
  localStorage.removeItem('llm_chat_token_expires')
}

// Handle response errors - session expiration (for login endpoint)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Handle 401 (Unauthorized) or 403 (Forbidden) - session expired
      if (error.response.status === 401 || error.response.status === 403) {
        // Only handle session expiration for authenticated endpoints (not login)
        if (!error.config?.url?.includes('/users/login')) {
          clearAuthData()
          // Redirect to login page
          if (window.location.pathname !== '/login') {
            window.location.href = '/login'
          }
        }
      }
    }
    return Promise.reject(error)
  }
)

/**
 * Login function that sends username and password to backend
 * @param {string} username - User's username
 * @param {string} password - User's password
 * @returns {Promise<Object>} Response object containing JWT token and user info
 */
export const login = async (username, password) => {
  try {
    // Common endpoints to try if 405 error occurs:
    // - '/login' (current)
    // - '/api/login'
    // - '/auth/login'
    // - '/api/auth/login'
    const response = await apiClient.post('/api/users/login', {
      username,
      password,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      // Uncomment below if backend expects form-data instead of JSON
      // transformRequest: [(data) => {
      //   const formData = new URLSearchParams()
      //   formData.append('username', data.username)
      //   formData.append('password', data.password)
      //   return formData
      // }],
      // headers: {
      //   'Content-Type': 'application/x-www-form-urlencoded',
      // },
    })

    // Backend returns: { access_token, token_type, user: { username, email } }
    const { access_token, token_type, user } = response.data

    // Store access token
    if (access_token) {
      // Verify token format (should be JWT: header.payload.signature)
      const tokenParts = access_token.split('.')
      if (tokenParts.length !== 3) {
        console.error('❌ [login] Invalid token format! Expected JWT with 3 parts, got:', tokenParts.length)
      }
      
      localStorage.setItem('jwt_token', access_token)
      localStorage.setItem('token_type', token_type || 'bearer')
      console.log('🔑 [login] Login token stored:', {
        tokenType: 'login',
        tokenLength: access_token.length,
        tokenStart: access_token.substring(0, 30) + '...',
        tokenEnd: '...' + access_token.substring(access_token.length - 20),
        tokenParts: tokenParts.length,
        isValidJWT: tokenParts.length === 3,
      })
    }

    // Store user info from the user object
    if (user) {
      localStorage.setItem('user_info', JSON.stringify({
        username: user.username,
      }))
    } else {
      // Fallback: If user object not in response, store the login username
      localStorage.setItem('user_info', JSON.stringify({
        username: username,
      }))
    }

    return response.data
  } catch (error) {
    // Handle different error scenarios
    if (error.response) {
      // Server responded with error status
      const status = error.response.status
      const statusText = error.response.statusText
      const errorMessage = error.response.data?.detail || error.response.data?.message || 'Login failed'
      
      // Provide more specific error messages
      if (status === 405) {
        throw new Error(`Method Not Allowed (405): The endpoint may not support POST method or the URL is incorrect. Please check the backend API endpoint.`)
      } else if (status === 404) {
        throw new Error(`Not Found (404): The endpoint '/api/users/login' was not found. Please check the backend API endpoint.`)
      } else if (status === 401) {
        throw new Error(errorMessage || 'Invalid credentials')
      } else {
        throw new Error(`${statusText} (${status}): ${errorMessage}`)
      }
    } else if (error.request) {
      // Request was made but no response received
      throw new Error('Network error. Please check your connection and backend URL.')
    } else {
      // Something else happened
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

/**
 * Signup function that sends user registration data to backend
 * @param {Object} userData - User registration data
 * @param {string} userData.username - User's username
 * @param {string} userData.email - User's email
 * @param {string} userData.password - User's password
 * @returns {Promise<Object>} Response object containing user info
 */
export const signup = async (userData) => {
  try {
    const response = await apiClient.post('/api/users/register', {
      username: userData.username,
      email: userData.email,
      password: userData.password,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return response.data
  } catch (error) {
    // Handle different error scenarios
    if (error.response) {
      // Server responded with error status
      const status = error.response.status
      const statusText = error.response.statusText
      const errorMessage = error.response.data?.detail || error.response.data?.message || 'Registration failed'
      
      // Provide more specific error messages
      if (status === 400) {
        throw new Error(errorMessage || 'Invalid registration data')
      } else if (status === 409) {
        throw new Error(errorMessage || 'Username or email already exists')
      } else {
        throw new Error(`${statusText} (${status}): ${errorMessage}`)
      }
    } else if (error.request) {
      // Request was made but no response received
      throw new Error('Network error. Please check your connection and backend URL.')
    } else {
      // Something else happened
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

/**
 * Get stored JWT token from localStorage
 * @returns {string|null} JWT token or null if not found
 */
export const getToken = () => {
  const token = localStorage.getItem('jwt_token')
  if (token) {
    const tokenParts = token.split('.')
    console.log('🔑 [login] Using login token:', {
      tokenType: 'login',
      tokenLength: token.length,
      tokenStart: token.substring(0, 30) + '...',
      tokenEnd: '...' + token.substring(token.length - 20),
      tokenParts: tokenParts.length,
      isValidJWT: tokenParts.length === 3,
    })
  } else {
    console.warn('⚠️ [login] No login token found in localStorage')
  }
  return token
}

/**
 * Get LLM chat token (separate from login token)
 * @returns {string|null} LLM chat token or null if not found
 */
export const getChatToken = () => {
  const token = localStorage.getItem('llm_chat_token')
  if (token) {
    console.log('🔑 [jenkins-SSE] Using chat token:', {
      tokenType: 'jenkins-SSE',
      tokenLength: token.length,
      tokenStart: token.substring(0, 20) + '...',
    })
  }
  return token
}

/**
 * Set LLM chat token
 * @param {string} token - LLM chat token
 */
export const setChatToken = (token) => {
  if (token) {
    localStorage.setItem('llm_chat_token', token)
  } else {
    localStorage.removeItem('llm_chat_token')
  }
}

/**
 * Get LLM chat token from backend using login token
 * Chat tokens expire in 1 hour - this function handles fetching and storing expiration
 * @returns {Promise<string>} LLM chat token
 */
export const fetchChatToken = async () => {
  try {
    // Get token directly from localStorage to avoid any processing
    const loginToken = localStorage.getItem('jwt_token')
    
    console.log('🔍 [login] Checking token in localStorage:', {
      hasToken: !!loginToken,
      tokenType: typeof loginToken,
      tokenLength: loginToken?.length,
      rawValue: loginToken,
    })
    
    if (!loginToken) {
      console.error('❌ [login] No token found in localStorage!')
      throw new Error('No login token found. Please login first.')
    }
    
    if (loginToken.trim() === '') {
      console.error('❌ [login] Token is empty string!')
      throw new Error('Token is empty. Please login again.')
    }

    // Verify token format
    const tokenParts = loginToken.split('.')
    const isValidJWT = tokenParts.length === 3
    
    const chatApiUrl = import.meta.env.VITE_CHAT_API_BASE_URL || 'http://localhost:8081'
    
    // Decode token to verify it's valid (without verifying signature)
    let decodedToken = null
    try {
      const payload = loginToken.split('.')[1]
      if (payload) {
        decodedToken = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
      }
    } catch (e) {
      console.warn('⚠️ [login] Could not decode token payload:', e)
    }
    
    console.log('🔑 [login] Preparing to send login token for exchange:', {
      tokenType: 'login',
      tokenLength: loginToken.length,
      tokenStart: loginToken.substring(0, 50) + '...',
      tokenEnd: '...' + loginToken.substring(loginToken.length - 30),
      tokenParts: tokenParts.length,
      isValidJWT: isValidJWT,
      decodedPayload: decodedToken,
      endpoint: `${chatApiUrl}/api/jenkins/auth/token`,
      fullToken: loginToken, // Log full token for debugging (remove in production)
    })
    
    // IMPORTANT: The backend error "Signature verification failed" means:
    // The chat API (port 8081) is using a DIFFERENT JWT secret key than the main API (port 8000)
    // This is a BACKEND CONFIGURATION ISSUE - both APIs must use the same JWT secret key
    if (decodedToken) {
      console.warn('⚠️ [login] Token payload decoded. If signature verification fails, check backend JWT secret keys match.')
    }
    
    if (!isValidJWT) {
      console.error('❌ [login] Invalid JWT format! Token should have 3 parts separated by dots')
      throw new Error('Invalid token format')
    }
    
    // Exchange login token for chat token
    // Try different approaches based on what backend expects
    
    // Approach 1: Authorization header with Bearer prefix (standard)
    console.log('📤 [login] Attempt 1: Sending with Authorization: Bearer {token}...')
    console.log('📤 [login] Token being sent:', {
      hasToken: !!loginToken,
      tokenLength: loginToken?.length,
      tokenValue: loginToken, // Full token for debugging
      authorizationHeader: `Bearer ${loginToken}`,
    })
    
    let response = await fetch(`${chatApiUrl}/api/jenkins/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginToken}`,
      },
    })

    console.log('📥 [login] Attempt 1 response:', response.status, response.statusText)
    
    // Log request details for debugging
    console.log('📋 [login] Request details:', {
      method: 'POST',
      url: `${chatApiUrl}/api/jenkins/auth/token`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginToken?.substring(0, 30)}...`,
      },
      hasBody: false,
    })

    // Approach 2: Authorization header without Bearer prefix
    if (!response.ok && (response.status === 400 || response.status === 401)) {
      const errorText1 = await response.text()
      console.log('⚠️ [login] Attempt 1 failed, trying Authorization header without Bearer prefix...', {
        status: response.status,
        error: errorText1,
      })
      
      console.log('📤 [login] Attempt 2: Token being sent:', {
        hasToken: !!loginToken,
        tokenValue: loginToken,
        authorizationHeader: loginToken,
      })
      
      response = await fetch(`${chatApiUrl}/api/jenkins/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': loginToken, // Token without Bearer prefix
        },
      })
      
      console.log('📥 [login] Attempt 2 response:', response.status, response.statusText)
    }

    // Approach 3: Token in request body
    if (!response.ok && (response.status === 400 || response.status === 401)) {
      const errorText2 = await response.text()
      console.log('⚠️ [login] Attempt 2 failed, trying token in request body...', {
        status: response.status,
        error: errorText2,
      })
      
      console.log('📤 [login] Attempt 3: Token being sent in body:', {
        hasToken: !!loginToken,
        tokenValue: loginToken,
        body: { token: loginToken },
      })
      
      response = await fetch(`${chatApiUrl}/api/jenkins/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: loginToken,
        }),
      })
      
      console.log('📥 [login] Attempt 3 response:', response.status, response.statusText)
    }

    // Approach 4: Token in body with different field name
    if (!response.ok && (response.status === 400 || response.status === 401)) {
      const errorText3 = await response.text()
      console.log('⚠️ [login] Attempt 3 failed, trying token in body as "access_token"...', {
        status: response.status,
        error: errorText3,
      })
      
      response = await fetch(`${chatApiUrl}/api/jenkins/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: loginToken,
        }),
      })
      
      console.log('📥 [login] Attempt 4 response:', response.status, response.statusText)
    }

    // Approach 5: Token in body as "login_token"
    if (!response.ok && (response.status === 400 || response.status === 401)) {
      const errorText4 = await response.text()
      console.log('⚠️ [login] Attempt 4 failed, trying token in body as "login_token"...', {
        status: response.status,
        error: errorText4,
      })
      
      response = await fetch(`${chatApiUrl}/api/jenkins/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login_token: loginToken,
        }),
      })
      
      console.log('📥 [login] Attempt 5 response:', response.status, response.statusText)
    }

    if (!response.ok) {
      let errorText = ''
      let errorJson = null
      try {
        errorText = await response.text()
        // Try to parse as JSON
        try {
          errorJson = JSON.parse(errorText)
        } catch (e) {
          // Not JSON, keep as text
        }
      } catch (e) {
        errorText = 'Unable to read error response'
      }
      
      console.error('❌ [login] Token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        errorJson: errorJson,
        tokenLength: loginToken.length,
        tokenStart: loginToken.substring(0, 30) + '...',
      })
      
      // If 400 Bad Request, show more details about what might be wrong
      if (response.status === 400) {
        console.error('⚠️ [login] 400 Bad Request - Backend might be expecting different request format')
        console.error('💡 [login] Possible issues:')
        console.error('   - Missing required fields in request body')
        console.error('   - Wrong field names in request body')
        console.error('   - Invalid request format')
        if (errorJson) {
          console.error('   - Backend error details:', errorJson)
        }
      }
      
      throw new Error(`Failed to get chat token: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    const chatToken = data.chat_token || data.access_token || data.token || data.llm_token
    
    if (!chatToken) {
      throw new Error('No chat token in response')
    }
    
    // Store chat token
    setChatToken(chatToken)
    
    // Store expiration time (1 hour from now, or use expires_in from response)
    const expiresIn = data.expires_in || 3600 // Default to 1 hour (3600 seconds)
    const expirationTime = Date.now() + (expiresIn * 1000) // Convert to milliseconds
    localStorage.setItem('llm_chat_token_expires', expirationTime.toString())
    
    console.log('🔑 [jenkins-SSE] Chat token obtained and stored:', {
      tokenType: 'jenkins-SSE',
      tokenLength: chatToken.length,
      tokenStart: chatToken.substring(0, 20) + '...',
      expiresIn: expiresIn + ' seconds',
    })
    return chatToken
  } catch (error) {
    console.error('❌ Error fetching chat token:', error)
    throw error
  }
}

/**
 * Check if chat token is expired or will expire soon (within 5 minutes)
 * @returns {boolean} True if token is expired or expiring soon
 */
export const isChatTokenExpired = () => {
  const expirationTime = localStorage.getItem('llm_chat_token_expires')
  if (!expirationTime) {
    return true // No expiration time means token is invalid
  }
  
  const expiresAt = parseInt(expirationTime, 10)
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000 // 5 minutes in milliseconds
  
  // Consider expired if current time is within 5 minutes of expiration
  return (now + fiveMinutes) >= expiresAt
}

/**
 * Get chat token, refreshing if expired or about to expire
 * @returns {Promise<string>} Valid chat token
 */
export const getValidChatToken = async () => {
  let chatToken = getChatToken()
  
  // If no token or token is expired/expiring soon, fetch a new one
  if (!chatToken || isChatTokenExpired()) {
    console.log('🔄 [jenkins-SSE] Chat token expired or missing, fetching new token...')
    chatToken = await fetchChatToken()
  } else {
    console.log('✅ [jenkins-SSE] Using existing valid chat token')
  }
  
  return chatToken
}

/**
 * Get user info from localStorage
 * @returns {Object|null} User info object or null if not found
 */
export const getUserInfo = () => {
  const userInfo = localStorage.getItem('user_info')
  return userInfo ? JSON.parse(userInfo) : null
}

/**
 * Remove JWT token, token type, and user info from localStorage (logout)
 */
export const logout = () => {
  clearAuthData()
}

/**
 * Decode JWT token to get payload
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded token payload or null
 */
const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (error) {
    console.error('Error decoding token:', error)
    return null
  }
}

/**
 * Check if JWT token is expired
 * @param {string} token - JWT token
 * @returns {boolean} True if token is expired or invalid
 */
export const isTokenExpired = (token) => {
  if (!token) return true
  
  const decoded = decodeToken(token)
  if (!decoded || !decoded.exp) return true
  
  // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
  const currentTime = Date.now() / 1000
  return decoded.exp < currentTime
}

/**
 * Handle session expiration - clears storage and redirects to login
 */
export const handleSessionExpiration = () => {
  clearAuthData()
  // Redirect to login page
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

/**
 * Check if user is authenticated and token is valid
 * @returns {boolean} True if token exists and is not expired
 */
export const isAuthenticated = () => {
  const token = getToken()
  if (!token) {
    console.warn('⚠️ No token found in localStorage')
    return false
  }
  
  // Check if token is expired
  if (isTokenExpired(token)) {
    console.warn('⚠️ Token is expired')
    // Don't auto-redirect here - let the calling code decide
    return false
  }
  
  return true
}

