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

// Add token and encryption to requests
apiClient.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem('jwt_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      console.log('🔑 [login] Using login token for API request:', {
        tokenType: 'login',
        url: config.url,
        method: config.method,
        tokenLength: token.length,
        tokenStart: token.substring(0, 20) + '...',
      })
    }
    
    if (['post', 'put', 'patch'].includes(config.method?.toLowerCase()) && config.data) {
      config.data = await encryptionService.encryptPayload(config.data, API_BASE_URL, '/api/crypto/public-key')
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Handle response errors - session expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Handle 401 (Unauthorized) or 403 (Forbidden) - session expired
      if (error.response.status === 401 || error.response.status === 403) {
        // Import here to avoid circular dependency
        import('./authService').then(({ handleSessionExpiration }) => {
          handleSessionExpiration()
        })
      }
    }
    return Promise.reject(error)
  }
)

/**
 * Save AWS credentials to backend
 * @param {Object} credentials - Credential object with name, accessKey, secretKey
 * @returns {Promise<Object>} Response from backend
 */
export const saveCloudCredentials = async (credentials) => {
  try {
    // JWT Bearer token is automatically included via the interceptor
    const response = await apiClient.post('/api/credentials/aws', {
      name: credentials.name,
      access_key: credentials.accessKey,
      secret_key: credentials.secretKey,
    })
    return response.data
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response.data?.message || `Failed to save credentials (Status: ${error.response.status})`
      )
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

/**
 * Get cloud credentials from backend
 * @returns {Promise<Array>} Array of credentials
 */
export const getCloudCredentials = async () => {
  try {
    const response = await apiClient.get('/api/credentials/cloud')
    return response.data
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response.data?.message || `Failed to get credentials (Status: ${error.response.status})`
      )
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

/**
 * Save SCM credentials to backend
 * @param {Object} credentials - Credential object with scm_name, username, pat
 * @returns {Promise<Object>} Response from backend
 */
export const saveSCMCredentials = async (credentials) => {
  try {
    // JWT Bearer token is automatically included via the interceptor
    const payload = {
      scm_name: credentials.scm_name,
      username: credentials.username,
      pat: credentials.pat,
    }
    
    // Only include base_url if provided
    if (credentials.base_url) {
      payload.base_url = credentials.base_url
    }
    
    const response = await apiClient.post('/api/scm/credentials', payload)
    return response.data
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response.data?.message || `Failed to save SCM credentials (Status: ${error.response.status})`
      )
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

/**
 * Get SCM credentials from backend
 * @returns {Promise<Array>} Array of SCM credentials
 */
export const getSCMCredentials = async () => {
  try {
    const response = await apiClient.get('/api/scm/credentials')
    return response.data
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response.data?.message || `Failed to get SCM credentials (Status: ${error.response.status})`
      )
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

/**
 * Update SCM credentials in backend
 * @param {string} scmId - SCM credential ID to update
 * @param {Object} credentials - Credential object with scm_name, username, pat, base_url
 * @returns {Promise<Object>} Response from backend
 */
export const updateSCMCredentials = async (scmId, credentials) => {
  try {
    // JWT Bearer token is automatically included via the interceptor
    const payload = {
      scm_name: credentials.scm_name,
      username: credentials.username,
    }
    
    // Only include pat if provided (for updates, PAT can be optional to keep existing value)
    if (credentials.pat) {
      payload.pat = credentials.pat
    }
    
    // Only include base_url if provided
    if (credentials.base_url) {
      payload.base_url = credentials.base_url
    }
    
    const response = await apiClient.put(`/api/scm/credentials/${scmId}`, payload)
    return response.data
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response.data?.message || error.response.data?.detail || `Failed to update SCM credentials (Status: ${error.response.status})`
      )
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

/**
 * Sync repositories from SCM (GitLab/GitHub/Bitbucket) and save to DB
 * @param {string} scmId - SCM credential ID
 * @returns {Promise<Object>} Response from backend with sync status
 */
export const syncSCMRepositories = async (scmId) => {
  try {
    // JWT Bearer token is automatically included via the interceptor
    const response = await apiClient.post(`/api/scm/credentials/${scmId}/sync-repositories`, {
      scm_id: scmId
    })
    return response.data
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response.data?.message || error.response.data?.detail || `Failed to sync repositories (Status: ${error.response.status})`
      )
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

/**
 * Save Jenkins credentials to backend
 * @param {Object} credentials - Credential object with jenkins_url, username, token, type, user_name
 * @returns {Promise<Object>} Response from backend
 */
export const saveJenkinsCredentials = async (credentials) => {
  try {
    // JWT Bearer token is automatically included via the interceptor
    const payload = {
      jenkins_url: credentials.jenkins_url,
      username: credentials.username,
      token: credentials.token,
      type: credentials.type || 'public', // Default to 'public' if not provided
      user_name: credentials.user_name || '', // User's name
    }
    
    const response = await apiClient.post('/api/jenkins/credentials', payload)
    return response.data
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response.data?.message || error.response.data?.detail || `Failed to save Jenkins credentials (Status: ${error.response.status})`
      )
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

/**
 * Get Jenkins credentials from backend
 * @returns {Promise<Array>} Array of Jenkins credentials
 */
export const getJenkinsCredentials = async () => {
  try {
    const response = await apiClient.get('/api/jenkins/credentials')
    return response.data
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response.data?.message || `Failed to get Jenkins credentials (Status: ${error.response.status})`
      )
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

/**
 * Sync Jenkins jobs/pipelines from Jenkins server and save to DB
 * @param {string} jenkinsId - Jenkins credential ID
 * @param {string} userName - User's name or username
 * @returns {Promise<Object>} Response from backend with sync status
 */
export const syncJenkinsJobs = async (jenkinsId, userName = '') => {
  try {
    // JWT Bearer token is automatically included via the interceptor
    const response = await apiClient.post(`/api/jenkins/credentials/${jenkinsId}/sync-data`, {
      jenkins_id: jenkinsId,
      user_name: userName
    })
    return response.data
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response.data?.message || error.response.data?.detail || `Failed to sync Jenkins jobs (Status: ${error.response.status})`
      )
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

