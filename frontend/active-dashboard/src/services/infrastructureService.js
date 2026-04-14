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
    const response = await apiClient.post('/api/infrastructure/network', networkData)
    return {
      ...response.data,
      message: response.data?.message || 'Network infrastructure created successfully!',
    }
  } catch (error) {
    console.error('Error creating network infrastructure:', error)
    throw new Error(error.response?.data?.detail || error.message || 'Failed to create network infrastructure')
  }
}

/**
 * Create servers infrastructure
 * @param {Object} serversData - Servers infrastructure data
 * @returns {Promise<Object>} Response from backend
 */
export const createServersInfrastructure = async (serversData) => {
  try {
    const payload = {
      project_name: serversData.projectName,
      instance_type: serversData.instanceType,
      instance_count: serversData.instanceCount,
      os_image: serversData.osImage,
      storage_size: serversData.storageSize,
      key_pair_name: serversData.keyPairName || null,
    }
    const response = await apiClient.post('/api/infrastructure/servers', payload)
    return {
      ...response.data,
      message: response.data?.message || 'Servers infrastructure created successfully!',
    }
  } catch (error) {
    console.error('Error creating servers infrastructure:', error)
    throw new Error(error.response?.data?.detail || error.message || 'Failed to create servers infrastructure')
  }
}

/**
 * Create serverless infrastructure
 * @param {Object} serverlessData - Serverless infrastructure data
 * @returns {Promise<Object>} Response from backend
 */
export const createServerlessInfrastructure = async (serverlessData) => {
  try {
    const payload = {
      project_name: serverlessData.projectName,
      runtime: serverlessData.runtime,
      memory_size: serverlessData.memorySize,
      timeout: serverlessData.timeout,
      handler: serverlessData.handler,
      description: serverlessData.description || null,
    }
    const response = await apiClient.post('/api/infrastructure/serverless', payload)
    return {
      ...response.data,
      message: response.data?.message || 'Serverless infrastructure created successfully!',
    }
  } catch (error) {
    console.error('Error creating serverless infrastructure:', error)
    throw new Error(error.response?.data?.detail || error.message || 'Failed to create serverless infrastructure')
  }
}

/**
 * Create cloud managed infrastructure
 * @param {Object} cloudData - Cloud managed infrastructure data
 * @returns {Promise<Object>} Response from backend
 */
export const createCloudManagedInfrastructure = async (cloudData) => {
  try {
    const payload = {
      project_name: cloudData.projectName,
      service_type: cloudData.serviceType,
      instance_class: cloudData.instanceClass,
      storage_size: cloudData.storageSize,
      service_name: cloudData.serviceName || null,
    }
    const response = await apiClient.post('/api/infrastructure/cloud-managed', payload)
    return {
      ...response.data,
      message: response.data?.message || 'Cloud managed infrastructure created successfully!',
    }
  } catch (error) {
    console.error('Error creating cloud managed infrastructure:', error)
    throw new Error(error.response?.data?.detail || error.message || 'Failed to create cloud managed infrastructure')
  }
}

/**
 * Fetch infrastructure for a specific project
 * @param {string} projectName - The name of the project
 * @returns {Promise<Object>} Response from backend
 */
export const getInfrastructureByProject = async (projectName) => {
  try {
    const response = await apiClient.get(`/api/infrastructure/project/${projectName}`)
    return response.data
  } catch (error) {
    console.error('Error fetching infrastructure:', error)
    throw new Error(error.response?.data?.detail || error.message || 'Failed to fetch infrastructure')
  }
}

/**
 * Delete all infrastructure for a specific project
 * @param {string} projectName - The name of the project
 * @returns {Promise<boolean>} True if successful
 */
export const deleteInfrastructureByProject = async (projectName) => {
  try {
    await apiClient.delete(`/api/infrastructure/project/${projectName}`)
    return true
  } catch (error) {
    console.error('Error deleting infrastructure:', error)
    throw new Error(error.response?.data?.detail || error.message || 'Failed to delete infrastructure')
  }
}

/**
 * Delete specific infrastructure item
 * @param {string} infraType - Type of infrastructure ('network', 'servers', etc)
 * @param {string} infraId - ObjectId of the infrastructure
 * @returns {Promise<boolean>} True if successful
 */
export const deleteSpecificInfrastructure = async (infraType, infraId) => {
  try {
    await apiClient.delete(`/api/infrastructure/${infraType}/${infraId}`)
    return true
  } catch (error) {
    console.error(`Error deleting ${infraType} infrastructure:`, error)
    throw new Error(error.response?.data?.detail || error.message || `Failed to delete ${infraType} infrastructure`)
  }
}

