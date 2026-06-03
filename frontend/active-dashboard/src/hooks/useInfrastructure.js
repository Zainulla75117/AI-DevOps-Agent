import { useState, useCallback } from 'react'
import { getResourcesByProject } from '../services/infrastructureService'

const INFRA_STORAGE_KEY = 'devops_infrastructure_map'

// Load infrastructure map from localStorage
const loadInfraMap = () => {
  try {
    const stored = localStorage.getItem(INFRA_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

// Save infrastructure map to localStorage
const saveInfraMap = (map) => {
  try {
    localStorage.setItem(INFRA_STORAGE_KEY, JSON.stringify(map))
  } catch (e) {
    console.error('Failed to save infrastructure map:', e)
  }
}

/**
 * Custom hook for infrastructure state management.
 * Handles localStorage sync, fetching from BE, and helper utilities.
 */
const useInfrastructure = () => {
  const [infrastructureMap, setInfrastructureMap] = useState(loadInfraMap)
  const [isLoadingInfra, setIsLoadingInfra] = useState(false)

  // ── Fetch infra from BE for a list of projects ─────────────────────
  const fetchInfraForProjects = useCallback(async (projectsList) => {
    if (!projectsList || projectsList.length === 0) return
    setIsLoadingInfra(true)
    try {
      const newMap = { ...infrastructureMap }
      // Fetch in parallel for all projects
      const results = await Promise.allSettled(
        projectsList.map(async (project) => {
          const projectId = project.id
          if (!projectId) return { projectId: null, items: [] }
          const resources = await getResourcesByProject(projectId)
          // Normalise into the flat array format used for rendering
          const items = (resources || []).map(r => ({
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
            depends_on: r.depends_on,
            infraType: r.type === 'compute' ? 'servers' : r.type === 'database' ? 'cloud-managed' : r.type,
            createdAt: r.created_at,
          }))
          return { projectId, items }
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.projectId) {
          newMap[result.value.projectId] = result.value.items
        }
      }

      setInfrastructureMap(newMap)
      saveInfraMap(newMap)
    } catch (error) {
      console.error('Failed to fetch infrastructure from backend:', error)
    } finally {
      setIsLoadingInfra(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-fetch infra for a single project ────────────────────────────
  const refreshInfraForProject = useCallback(async (projectId) => {
    if (!projectId) return
    try {
      const resources = await getResourcesByProject(projectId)
      const items = (resources || []).map(r => ({
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
        depends_on: r.depends_on,
        infraType: r.type === 'compute' ? 'servers' : r.type === 'database' ? 'cloud-managed' : r.type,
        createdAt: r.created_at,
      }))
      setInfrastructureMap(prev => {
        const updated = { ...prev, [projectId]: items }
        saveInfraMap(updated)
        return updated
      })
    } catch (error) {
      console.error(`Failed to refresh infra for project ${projectId}:`, error)
    }
  }, [])

  // ── Get infra items for a project (with auto-recovery) ─────────────
  const getProjectInfra = useCallback((project) => {
    const projectId = project.id || project.project_name
    const data = infrastructureMap[projectId]

    if (Array.isArray(data)) return data

    // Auto-recover corrupted dictionary data from earlier buggy localStorage saves
    if (data && typeof data === 'object') {
      const flattened = []
      if (data.network) data.network.forEach(i => flattened.push({ ...i, infraType: 'network' }))
      if (data.servers) data.servers.forEach(i => flattened.push({ ...i, infraType: 'servers' }))
      if (data.serverless) data.serverless.forEach(i => flattened.push({ ...i, infraType: 'serverless' }))
      if (data.cloud_managed) data.cloud_managed.forEach(i => flattened.push({ ...i, infraType: 'cloud-managed' }))
      return flattened
    }

    return []
  }, [infrastructureMap])

  // ── Get unique type labels for infra items ─────────────────────────
  const getInfraTypeSummary = useCallback((infraItems) => {
    if (!infraItems || infraItems.length === 0) return null
    const typeLabels = {
      'network': 'Network',
      'servers': 'Servers',
      'serverless': 'Serverless',
      'cloud-managed': 'Cloud Managed'
    }
    const types = infraItems.map((i) => {
      return typeLabels[i.infraType] || (i.infraType === 'auto' ? 'AI Provisioned' : i.infraType || i.type || 'Unknown')
    })
    return [...new Set(types)]
  }, [])

  // ── Handle partial infra update (after single-resource delete) ─────
  const handleInfraUpdated = useCallback((freshData, deletingProject) => {
    if (!deletingProject) return;
    const projectId = deletingProject.id || deletingProject.project_name

    // Handle both unified array format (new) and legacy categorised format
    let flattened = [];
    if (Array.isArray(freshData)) {
      // New unified format — array of resources with type field
      flattened = freshData.map(r => ({
        ...r,
        ...r.config,
        infraType: r.type === 'compute' ? 'servers' : r.type === 'database' ? 'cloud-managed' : r.type,
      }));
    } else if (freshData) {
      // Legacy categorised format fallback
      if (freshData.network) freshData.network.forEach(i => flattened.push({ ...i, infraType: 'network' }));
      if (freshData.servers) freshData.servers.forEach(i => flattened.push({ ...i, infraType: 'servers' }));
      if (freshData.serverless) freshData.serverless.forEach(i => flattened.push({ ...i, infraType: 'serverless' }));
      if (freshData.cloud_managed) freshData.cloud_managed.forEach(i => flattened.push({ ...i, infraType: 'cloud-managed' }));
    }

    setInfrastructureMap(prev => {
      const updated = { ...prev, [projectId]: flattened }
      saveInfraMap(updated)
      return updated
    })
  }, [])

  // ── Handle full project infra wipe ─────────────────────────────────
  const handleDeletedAll = useCallback((deletingProject) => {
    if (!deletingProject) return;
    const projectId = deletingProject.id || deletingProject.project_name

    // Clear infrastructure map for this project
    setInfrastructureMap((prev) => {
      const updated = { ...prev }
      delete updated[projectId]
      saveInfraMap(updated)
      return updated
    })

    // Clear any cached chat session data for this project from localStorage
    // so the next chat session starts completely fresh
    try {
      const chatSessionKey = `infra_chat_sessions_${projectId}`
      localStorage.removeItem(chatSessionKey)
      // Also clear any draft messages for this project
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`draft_${projectId}_`)) {
          localStorage.removeItem(key)
        }
      })
    } catch { /* ignore localStorage errors */ }

    // Re-fetch from BE to confirm deletion
    refreshInfraForProject(projectId)
  }, [refreshInfraForProject])

  return {
    infrastructureMap,
    isLoadingInfra,
    fetchInfraForProjects,
    refreshInfraForProject,
    getProjectInfra,
    getInfraTypeSummary,
    handleInfraUpdated,
    handleDeletedAll,
  }
}

export default useInfrastructure
