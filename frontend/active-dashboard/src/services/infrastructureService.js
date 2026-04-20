import axios from 'axios'

/**
 * Infrastructure Service — Unified Resource API
 * 
 * Manages infrastructure resources through the unified /api/infrastructure/resources
 * endpoint. Replaces the former per-type endpoints (/network, /servers, etc.).
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

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
  (error) => Promise.reject(error)
)

// Handle response errors - session expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 401 || error.response.status === 403) {
        import('./authService').then(({ handleSessionExpiration }) => {
          handleSessionExpiration()
        })
      }
    }
    return Promise.reject(error)
  }
)


// ═══════════════════════════════════════════════════════════════════════
//  UNIFIED RESOURCE CRUD
// ═══════════════════════════════════════════════════════════════════════

/**
 * Create a new infrastructure resource (any type).
 * @param {Object} data - { project_id, type, name, provider, region, env, config, depends_on, state }
 * @returns {Promise<Object>} Response { id, message, type, data }
 */
export const createInfraResource = async (data) => {
  try {
    const response = await apiClient.post('/api/infrastructure/resources', data)
    return {
      ...response.data,
      message: response.data?.message || `${data.type} resource created successfully!`,
    }
  } catch (error) {
    console.error('Error creating infrastructure resource:', error)
    throw new Error(
      error.response?.data?.detail || error.message || 'Failed to create infrastructure resource'
    )
  }
}

/**
 * Fetch all infrastructure resources for a project.
 * @param {string} projectId - The project ObjectId
 * @param {Object} [filters] - Optional { type, env }
 * @returns {Promise<Array>} Array of resource objects
 */
export const getResourcesByProject = async (projectId, filters = {}) => {
  try {
    const params = new URLSearchParams()
    if (filters.type) params.append('type', filters.type)
    if (filters.env) params.append('env', filters.env)
    const query = params.toString() ? `?${params.toString()}` : ''

    const response = await apiClient.get(`/api/infrastructure/resources/project/${projectId}${query}`)
    return response.data
  } catch (error) {
    console.error('Error fetching infrastructure resources:', error)
    throw new Error(
      error.response?.data?.detail || error.message || 'Failed to fetch infrastructure resources'
    )
  }
}

/**
 * Get a single resource by ID.
 * @param {string} resourceId
 * @returns {Promise<Object>}
 */
export const getResource = async (resourceId) => {
  try {
    const response = await apiClient.get(`/api/infrastructure/resources/${resourceId}`)
    return response.data
  } catch (error) {
    console.error('Error fetching resource:', error)
    throw new Error(
      error.response?.data?.detail || error.message || 'Failed to fetch resource'
    )
  }
}

/**
 * Update a resource's config/state.
 * @param {string} resourceId
 * @param {Object} data - { config, name, state, actual_state, depends_on, change_reason, changed_by }
 * @returns {Promise<Object>}
 */
export const updateResource = async (resourceId, data) => {
  try {
    const response = await apiClient.put(`/api/infrastructure/resources/${resourceId}`, data)
    return response.data
  } catch (error) {
    console.error('Error updating resource:', error)
    throw new Error(
      error.response?.data?.detail || error.message || 'Failed to update resource'
    )
  }
}

/**
 * Delete a single resource (checks dependencies).
 * @param {string} resourceId
 * @returns {Promise<Object>} { message }
 */
export const deleteResource = async (resourceId) => {
  try {
    const response = await apiClient.delete(`/api/infrastructure/resources/${resourceId}`)
    return response.data
  } catch (error) {
    console.error('Error deleting resource:', error)
    throw new Error(
      error.response?.data?.detail || error.message || 'Failed to delete resource'
    )
  }
}

/**
 * Delete ALL resources for a project.
 * @param {string} projectId
 * @returns {Promise<Object>} { message, deleted_count }
 */
export const deleteResourcesByProject = async (projectId) => {
  try {
    const response = await apiClient.delete(`/api/infrastructure/resources/project/${projectId}`)
    return response.data
  } catch (error) {
    console.error('Error deleting project resources:', error)
    throw new Error(
      error.response?.data?.detail || error.message || 'Failed to delete project resources'
    )
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  VERSION HISTORY
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch version history for a resource.
 * @param {string} resourceId
 * @returns {Promise<Array>}
 */
export const getResourceVersions = async (resourceId) => {
  try {
    const response = await apiClient.get(`/api/infrastructure/resources/${resourceId}/versions`)
    return response.data
  } catch (error) {
    console.error('Error fetching resource versions:', error)
    throw new Error(
      error.response?.data?.detail || error.message || 'Failed to fetch resource versions'
    )
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  DEPENDENCY GRAPH
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch dependency graph for all resources in a project.
 * @param {string} projectId
 * @returns {Promise<Object>} { project_id, nodes }
 */
export const getDependencyGraph = async (projectId) => {
  try {
    const response = await apiClient.get(`/api/infrastructure/resources/project/${projectId}/graph`)
    return response.data
  } catch (error) {
    console.error('Error fetching dependency graph:', error)
    throw new Error(
      error.response?.data?.detail || error.message || 'Failed to fetch dependency graph'
    )
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  BACKWARD COMPATIBILITY ADAPTERS
//  These wrap the new unified API so existing code can transition
//  incrementally. They map old per-type payloads into the new format.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Legacy adapter: create network infrastructure
 */
export const createNetworkInfrastructure = async (networkData) => {
  const data = {
    project_id: networkData.project_id,
    type: 'network',
    name: networkData.vpc_name || networkData.vpcName || networkData.project_name || 'unnamed-vpc',
    provider: networkData.provider || 'aws',
    region: networkData.region || 'us-east-1',
    env: networkData.env || 'dev',
    config: {
      vpc_name: networkData.vpc_name || networkData.vpcName,
      vpc_cidr: networkData.vpc_cidr || networkData.vpcCidr,
      nat_gateway: networkData.nat_gateway || networkData.natGateway,
      public_subnet_count: networkData.count_of_public_subnets || networkData.publicSubnetCount,
      private_subnet_count: networkData.count_of_private_subnets || networkData.privateSubnetCount,
      availability_zones_count: networkData.availability_zones_count || networkData.availabilityZones,
      nat_gateway_az_count: networkData.nat_gateway_az_count || networkData.natGatewayAzCount || 0,
      enable_dns_hostnames: networkData.enable_dns_hostnames ?? networkData.enableDnsHostnames ?? true,
      enable_dns_support: networkData.enable_dns_support ?? networkData.enableDnsSupport ?? true,
    },
    state: 'planned',
  }
  return createInfraResource(data)
}

/**
 * Legacy adapter: create servers infrastructure
 */
export const createServersInfrastructure = async (serversData) => {
  const config = {
    instance_type: serversData.instance_type || serversData.instanceType,
    instance_count: serversData.instance_count || serversData.instanceCount,
    os_image: serversData.os_image || serversData.osImage,
    storage_size: serversData.storage_size || serversData.storageSize,
  }
  // Security: move key_pair_name to secret_ref
  const keyPair = serversData.key_pair_name || serversData.keyPairName
  if (keyPair) {
    config.secret_ref = `aws-secrets-manager/keypair-${keyPair}`
  }

  const osImg = config.os_image || 'server'
  const instType = config.instance_type || 'instance'

  const data = {
    project_id: serversData.project_id,
    type: 'compute',
    name: `${osImg}-${instType}`,
    provider: serversData.provider || 'aws',
    region: serversData.region || 'us-east-1',
    env: serversData.env || 'dev',
    config,
    depends_on: serversData.depends_on || [],
    state: 'planned',
  }
  return createInfraResource(data)
}

/**
 * Legacy adapter: create serverless infrastructure
 */
export const createServerlessInfrastructure = async (serverlessData) => {
  const data = {
    project_id: serverlessData.project_id,
    type: 'serverless',
    name: (serverlessData.handler || 'function').split('.')[0],
    provider: serverlessData.provider || 'aws',
    region: serverlessData.region || 'us-east-1',
    env: serverlessData.env || 'dev',
    config: {
      runtime: serverlessData.runtime,
      memory_size: serverlessData.memory_size || serverlessData.memorySize,
      timeout: serverlessData.timeout,
      handler: serverlessData.handler,
      description: serverlessData.description || null,
    },
    state: 'planned',
  }
  return createInfraResource(data)
}

/**
 * Legacy adapter: create cloud managed infrastructure
 */
export const createCloudManagedInfrastructure = async (cloudData) => {
  const data = {
    project_id: cloudData.project_id,
    type: 'database',
    name: cloudData.service_name || cloudData.serviceName || `${cloudData.service_type || cloudData.serviceType || 'service'}-instance`,
    provider: cloudData.provider || 'aws',
    region: cloudData.region || 'us-east-1',
    env: cloudData.env || 'dev',
    config: {
      service_type: cloudData.service_type || cloudData.serviceType,
      instance_class: cloudData.instance_class || cloudData.instanceClass,
      storage_size: cloudData.storage_size || cloudData.storageSize,
      service_name: cloudData.service_name || cloudData.serviceName || null,
    },
    state: 'planned',
  }
  return createInfraResource(data)
}

/**
 * Legacy adapter: fetch infra by project name (resolves to project_id first)
 * @deprecated Use getResourcesByProject(projectId) instead
 */
export const getInfrastructureByProject = async (projectId) => {
  // The new API expects project_id (ObjectId), not project_name.
  // The caller should pass in the project's ObjectId directly.
  const resources = await getResourcesByProject(projectId)

  // Reshape into the legacy format for backward compatibility
  const result = {
    network: [],
    servers: [],
    serverless: [],
    cloud_managed: [],
  }

  for (const r of resources) {
    const item = {
      id: r.id,
      _id: r.id,
      ...r.config,
      type: r.type,
      name: r.name,
      state: r.state,
      version: r.version,
      provider: r.provider,
      region: r.region,
      env: r.env,
    }

    if (r.type === 'network') result.network.push(item)
    else if (r.type === 'compute') result.servers.push(item)
    else if (r.type === 'serverless') result.serverless.push(item)
    else if (r.type === 'database') result.cloud_managed.push(item)
  }

  return result
}

/**
 * Legacy adapter: delete all infra by project
 * @deprecated Use deleteResourcesByProject(projectId) instead
 */
export const deleteInfrastructureByProject = async (projectId) => {
  await deleteResourcesByProject(projectId)
  return true
}

/**
 * Legacy adapter: delete specific infra item
 * @deprecated Use deleteResource(resourceId) instead
 */
export const deleteSpecificInfrastructure = async (_infraType, infraId) => {
  await deleteResource(infraId)
  return true
}
