import axios from 'axios'

/**
 * Infrastructure Service - Manages infrastructure creation API calls
 */

// Configure your backend API URL here
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
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
 * Create network infrastructure
 * @param {Object} networkData - Network infrastructure data
 * @returns {Promise<Object>} Response from backend
 */
export const createNetworkInfrastructure = async (networkData) => {
  try {
    // Prepare payload with snake_case keys as required by backend
    const payload = {
      project_name: networkData.project_name || '',
      vpc_name: networkData.vpc_name || '',
      vpc_cidr: networkData.vpc_cidr || '',
      no_of_az: networkData.no_of_az || 1,
      public_subnet_count: networkData.public_subnet_count || 0,
      private_subnet_count: networkData.private_subnet_count || 0,
      nat_gateway: networkData.nat_gateway || 'none',
      enable_dns_hostname: networkData.enable_dns_hostname !== undefined ? networkData.enable_dns_hostname : true,
      enable_dns_support: networkData.enable_dns_support !== undefined ? networkData.enable_dns_support : true,
    }

    // Send to backend API (JWT Bearer token is automatically included via interceptor)
    const response = await apiClient.post('/api/infrastructure/network', payload)

    // Return response with message for toast notification
    return {
      ...response.data,
      message: response.data?.message || response.data?.detail || 'Network infrastructure created successfully!',
    }
  } catch (error) {
    console.error('Error creating network infrastructure:', error)
    if (error.response) {
      throw new Error(
        error.response.data?.message || `Failed to create network infrastructure (Status: ${error.response.status})`
      )
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

