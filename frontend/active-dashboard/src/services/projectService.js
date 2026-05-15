import axios from 'axios'

/**
 * Project Service - Manages project data in localStorage and backend API
 */

const PROJECTS_STORAGE_KEY = 'devops_projects'

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
 * Get all projects from backend API
 * @returns {Promise<Array>} Array of project objects
 */
export const fetchProjects = async () => {
  try {
    // JWT Bearer token is automatically included via interceptor
    const response = await apiClient.get('/api/projects/view')
    // Backend returns a direct array of projects
    // If response.data is already an array, return it; otherwise check for projects property
    const projects = Array.isArray(response.data) ? response.data : (response.data.projects || [])
    return projects
  } catch (error) {
    console.error('Error fetching projects:', error)
    if (error.response) {
      throw new Error(
        error.response.data?.message || `Failed to fetch projects (Status: ${error.response.status})`
      )
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

/**
 * Get all projects from localStorage (deprecated - use fetchProjects instead)
 * @returns {Array} Array of project objects
 */
export const getProjects = () => {
  try {
    const projects = localStorage.getItem(PROJECTS_STORAGE_KEY)
    return projects ? JSON.parse(projects) : []
  } catch (error) {
    console.error('Error getting projects:', error)
    return []
  }
}

/**
 * Save a new project to backend API
 * @param {Object} project - Project object with projectName, description, domain, etc.
 * @returns {Promise<Object>} The saved project from backend
 */
export const createProject = async (project) => {
  try {
    // Prepare payload with snake_case keys as required by backend
    const payload = {
      project_name: project.projectName || project.project_name || '',
      description: project.description || '',
      domain: project.domain || '',
      platform: project.platform || '',
      cloud_provider: project.cloudProvider || project.cloud_provider || '',
      region: project.region || '',
      iam_name: project.iamName || project.iam_name || '',
      environment: project.environment || '',
      expected_traffic: project.expectedTraffic || project.expected_traffic || '',
      cost_preference: project.costPreference || project.cost_preference || '',
      linked_repositories: project.linkedRepositories || project.linked_repositories || [],
    }

    // Send to backend API (JWT Bearer token is automatically included via interceptor)
    const response = await apiClient.post('/api/create/projects', payload)

    // Return response with message for toast notification
    return {
      ...response.data,
      message: response.data?.message || response.data?.detail || 'Project created successfully!',
      responseData: response.data,
    }
  } catch (error) {
    console.error('Error creating project:', error)
    if (error.response) {
      throw new Error(
        error.response.data?.message || `Failed to create project (Status: ${error.response.status})`
      )
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

/**
 * Get a project by ID
 * @param {number} projectId - Project ID
 * @returns {Object|null} Project object or null if not found
 */
export const getProjectById = (projectId) => {
  try {
    const projects = getProjects()
    return projects.find((p) => p.id === projectId) || null
  } catch (error) {
    console.error('Error getting project:', error)
    return null
  }
}

/**
 * Update a project
 * @param {number} projectId - Project ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated project or null if not found
 */
export const updateProject = async (projectId, updates) => {
  try {
    const payload = { ...updates };
    
    // Convert camelCase to snake_case if necessary for backend
    if (payload.projectName) { payload.project_name = payload.projectName; delete payload.projectName; }
    if (payload.cloudProvider) { payload.cloud_provider = payload.cloudProvider; delete payload.cloudProvider; }
    if (payload.iamName) { payload.iam_name = payload.iamName; delete payload.iamName; }
    if (payload.expectedTraffic) { payload.expected_traffic = payload.expectedTraffic; delete payload.expectedTraffic; }
    if (payload.costPreference) { payload.cost_preference = payload.costPreference; delete payload.costPreference; }
    if (payload.linkedRepositories) { payload.linked_repositories = payload.linkedRepositories; delete payload.linkedRepositories; }

    const response = await apiClient.put(`/api/projects/${projectId}`, payload)
    return response.data
  } catch (error) {
    console.error('Error updating project:', error)
    if (error.response) {
      throw new Error(
        error.response.data?.message || `Failed to update project (Status: ${error.response.status})`
      )
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

/**
 * Delete a project
 * @param {string} projectId - Project ID
 * @returns {Promise<boolean>} True if deleted successfully
 */
export const deleteProject = async (projectId) => {
  try {
    await apiClient.delete(`/api/projects/${projectId}`)
    return true
  } catch (error) {
    console.error('Error deleting project:', error)
    if (error.response) {
      throw new Error(
        error.response.data?.detail || error.response.data?.message || `Failed to delete project (Status: ${error.response.status})`
      )
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

/**
 * Get resources for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Array of resources
 */
export const getProjectResources = async (projectId) => {
  try {
    const response = await apiClient.get(`/api/infrastructure/resources/project/${projectId}`)
    return response.data
  } catch (error) {
    console.error('Error fetching project resources:', error)
    if (error.response?.status === 404) return []
    if (error.response) {
      throw new Error(
        error.response.data?.detail || `Failed to fetch resources (Status: ${error.response.status})`
      )
    }
    throw new Error(error.message || 'An unexpected error occurred')
  }
}
