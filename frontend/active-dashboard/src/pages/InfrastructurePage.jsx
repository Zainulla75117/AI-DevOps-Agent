import { useEffect, useState, useRef, useCallback } from 'react'
import { fetchProjects, updateProject } from '../services/projectService'
import { getSCMRepos } from '../services/credentialService'
import { deleteInfrastructureByProject, getResourcesByProject } from '../services/infrastructureService'
import { useAuth } from '../hooks/useAuth'
import PageLayout from '../components/PageLayout'
import InfraChatInterface from '../components/InfraChatInterface'
import InfrastructureView from '../components/InfrastructureView'
import DeleteInfraModal from '../components/DeleteInfraModal'
import Toast from '../components/Toast'
import { motion } from 'framer-motion'
import { Server, Cloud, Database, Network, Activity, LayoutTemplate } from 'lucide-react'

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

const InfrastructurePage = () => {
  const { userInfo, handleLogout } = useAuth()
  const [projects, setProjects] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [selectedProject, setSelectedProject] = useState(null)

  const filteredProjects = projects.filter(p =>
    (p.project_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  // New workflow states
  const [selectedRepo, setSelectedRepo] = useState(null)
  const [isRepoSelectionSkipped, setIsRepoSelectionSkipped] = useState(false)
  const [viewMode, setViewMode] = useState(null) // 'view' | null
  const [deletingProject, setDeletingProject] = useState(null)

  const [infrastructureMap, setInfrastructureMap] = useState(loadInfraMap)
  const [isLoadingInfra, setIsLoadingInfra] = useState(false)

  // Repo Linking State
  const [scmRepos, setScmRepos] = useState([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [isUpdatingProject, setIsUpdatingProject] = useState(false)

  const [toast, setToast] = useState(null)
  const hasFetchedRef = useRef(false)

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

  useEffect(() => {
    document.title = 'infraXai - Infrastructure'
  }, [])

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true
      loadProjects()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Automatically fetch SCM repos when repo selection screen is active
  useEffect(() => {
    if (selectedProject && !selectedRepo && !isRepoSelectionSkipped && !viewMode) {
      const fetchRepos = async () => {
        setIsLoadingRepos(true)
        try {
          const repos = await getSCMRepos()
          setScmRepos(Array.isArray(repos) ? repos : (repos.data || []))
        } catch (err) {
          console.error('Failed to load repositories', err)
        } finally {
          setIsLoadingRepos(false)
        }
      }
      fetchRepos()
    }
  }, [selectedProject, selectedRepo, isRepoSelectionSkipped, viewMode])

  const loadProjects = async () => {
    setIsLoadingProjects(true)
    try {
      const projectsArray = await fetchProjects()
      const projectsList = Array.isArray(projectsArray) ? projectsArray : []
      setProjects(projectsList)
      // Fetch infrastructure from BE for all projects
      fetchInfraForProjects(projectsList)
    } catch (error) {
      setToast({
        message: error.message || 'Failed to load projects',
        type: 'error',
      })
      setProjects([])
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const getEnvironmentBadge = (env) => {
    const envLower = env?.toLowerCase() || ''
    if (envLower.includes('dev') || envLower === 'development') {
      return { label: 'Dev', color: 'bg-blue-50 text-blue-700 border-blue-200', leftBorder: 'border-l-blue-400' }
    }
    if (envLower.includes('qa') || envLower === 'testing' || envLower === 'staging') {
      return { label: 'QA', color: 'bg-amber-50 text-amber-700 border-amber-200', leftBorder: 'border-l-amber-400' }
    }
    if (envLower.includes('prod') || envLower === 'production') {
      return { label: 'Prod', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', leftBorder: 'border-l-emerald-400' }
    }
    return { label: env || 'Unknown', color: 'bg-slate-50 text-slate-700 border-slate-200', leftBorder: 'border-l-slate-300' }
  }

  const getProviderIcon = (provider) => {
    const p = (provider || '').toLowerCase()
    if (p === 'github') {
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#181717]" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.022A9.606 9.606 0 0112 6.82c.85.004 1.705.114 2.504.336 1.909-1.29 2.747-1.022 2.747-1.022.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
      )
    }
    if (p === 'gitlab') {
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#FC6D26]" fill="currentColor">
          <path d="M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.423-.73-.423-.867 0L16.418 9.45H7.582L4.918 1.263c-.137-.423-.73-.423-.867 0L1.387 9.452.045 13.587c-.121.38.016.8.339 1.038L12 23.08l11.616-8.455c.323-.239.46-.658.339-1.038z" />
        </svg>
      )
    }
    if (p === 'bitbucket') {
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#2684FF]" fill="currentColor">
          <path d="M.768 2.802a.853.853 0 01.839-.705h20.785a.853.853 0 01.84.705l3.298 20.306a.854.854 0 01-.84.99H2.308a.854.854 0 01-.84-.99L.768 2.802zM14.654 15.6l1.246-7.854H8.101l1.247 7.854h5.306z" />
        </svg>
      )
    }
    return (
      <svg className="w-6 h-6 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M13 2.032a8 8 0 100 15.936V2.032zm-2 15.936a8 8 0 110-15.936v15.936z" clipRule="evenodd" />
      </svg>
    )
  }

  const getProjectTypeLabel = (project) => {
    if (project.domain === 'web') return 'Web Application'
    if (project.domain === 'api') return 'Backend API'
    if (project.domain === 'microservices') return 'Microservices'
    if (project.domain === 'data') return 'Data / Pipeline'
    if (project.domain) return 'Web Application'
    return 'Project'
  }

  const handleCreateInfra = (project) => {
    setSelectedProject(project)
    setSelectedRepo(null)
    setIsRepoSelectionSkipped(false)
  }

  const handleManageInfra = (project) => {
    setSelectedProject(project)
    setViewMode('view')
  }

  const handleDeleteInfra = (project) => {
    setDeletingProject(project)
  }

  const handleInfraUpdated = (freshData) => {
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
  }

  const handleDeletedAll = () => {
    if (!deletingProject) return;
    const projectId = deletingProject.id || deletingProject.project_name
    setInfrastructureMap((prev) => {
      const updated = { ...prev }
      delete updated[projectId]
      saveInfraMap(updated)
      return updated
    })
    setToast({ message: `Infrastructure for "${deletingProject.project_name}" deleted successfully.`, type: 'success' })
    setDeletingProject(null)
    // Re-fetch from BE to confirm deletion
    refreshInfraForProject(projectId)
  }

  // Back Navigation Handlers
  const handleBackToCards = () => {
    setSelectedProject(null)
    setSelectedRepo(null)
    setIsRepoSelectionSkipped(false)
    setViewMode(null)
  }

  const handleBackToRepoSelector = () => {
    setSelectedRepo(null)
    setIsRepoSelectionSkipped(false)
  }

  const handleInfrastructureCreated = (infraData, message) => {
    const projectId = selectedProject?.id || selectedProject?.project_name
    setToast({ message: message || 'Infrastructure created successfully!', type: 'success' })

    // Re-fetch from BE to get the actual saved resource
    if (projectId) {
      refreshInfraForProject(projectId)
    }
  }

  const getProjectInfra = (project) => {
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
  }

  const getInfraTypeSummary = (infraItems) => {
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
  }

  // --- RENDER: AI Chat Interface ---
  if (selectedProject && (selectedRepo || isRepoSelectionSkipped) && !viewMode) {
    return (
      <PageLayout userInfo={userInfo} onLogout={handleLogout}>
        <main className="flex-1 overflow-y-auto bg-slate-50/50 backdrop-blur-3xl w-full">
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
            <InfraChatInterface
              project={selectedProject}
              selectedRepo={selectedRepo}
              onCancel={handleBackToRepoSelector}
              onInfrastructureCreated={handleInfrastructureCreated}
            />
          </div>
        </main>
      </PageLayout>
    )
  }

  // --- RENDER: Repository Selector Picker ---
  if (selectedProject && !selectedRepo && !isRepoSelectionSkipped && !viewMode) {
    const linkedRepos = selectedProject.linked_repositories || []

    return (
      <PageLayout userInfo={userInfo} onLogout={handleLogout}>
        <main className="flex-1 overflow-y-auto bg-slate-50/50 backdrop-blur-3xl w-full">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
            <button
              onClick={handleBackToCards}
              className="relative z-10 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 mb-6 transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to projects
            </button>

            <div className="mb-10 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl mx-auto flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2 font-display">
                Select Target Repository
              </h1>
              <p className="text-base text-slate-600 font-medium max-w-xl mx-auto">
                Which repository are you building infrastructure for? The AI will analyze this repository's code to make optimal decisions.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {isLoadingRepos ? (
                <div className="flex flex-col items-center justify-center p-12">
                  <span className="w-8 h-8 border-4 border-blue-400 border-t-blue-600 rounded-full animate-spin mb-4"></span>
                  <p className="text-slate-500 font-medium">Loading repositories...</p>
                </div>
              ) : scmRepos.length > 0 ? (
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {scmRepos.map((repo, idx) => {
                    const isLinked = linkedRepos.some(lr => lr.repo_full_name === repo.name_with_namespace)
                    return (
                      <button
                        key={idx}
                        disabled={isUpdatingProject}
                        onClick={async () => {
                          if (!isLinked) {
                            setIsUpdatingProject(true)
                            try {
                              const newLinkedRepos = [...linkedRepos, {
                                repo_full_name: repo.name_with_namespace,
                                credential_id: repo.scm_id,
                                provider: repo.scm_provider,
                                repo_id: repo.id
                              }]
                              const updatedProject = await updateProject(selectedProject.id, { linked_repositories: newLinkedRepos })
                              setSelectedProject(updatedProject)
                              setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p))
                              setSelectedRepo({
                                repo_full_name: repo.name_with_namespace,
                                credential_id: repo.scm_id,
                                provider: repo.scm_provider || repo.provider,
                                repo_id: repo.id
                              })
                            } catch (err) {
                              setToast({ message: err.message || 'Failed to link repository', type: 'error' })
                            } finally {
                              setIsUpdatingProject(false)
                            }
                          } else {
                            const linked = linkedRepos.find(lr => lr.repo_full_name === repo.name_with_namespace)
                            setSelectedRepo({ ...linked, repo_id: linked.repo_id || repo.id })
                          }
                        }}
                        className={`w-full flex items-center justify-between p-6 transition-colors duration-150 text-left group ${isUpdatingProject ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                            {getProviderIcon(repo.scm_provider || repo.provider)}
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                {repo.name_with_namespace}
                              </h3>
                              {isLinked && (
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 rounded-full">
                                  Linked
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 capitalize flex items-center gap-2 mt-0.5">
                              <span className={`w-2 h-2 rounded-full ${isLinked ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
                              {repo.scm_provider} Provider
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {!isLinked && (
                            <span className="text-sm font-medium text-slate-400 group-hover:text-blue-500 transition-colors">
                              Click to link & select
                            </span>
                          )}
                          <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">No Repositories Synced</h3>
                  <p className="text-slate-500 max-w-sm mx-auto mb-6">
                    You haven't synced any SCM repositories yet. Go to Settings to connect GitHub, GitLab, or Bitbucket.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col items-center justify-center gap-4">
              <button
                onClick={() => setIsRepoSelectionSkipped(true)}
                className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
              >
                Skip repository selection
              </button>
            </div>
          </div>
        </main>
      </PageLayout>
    )
  }

  // --- RENDER: View Infrastructure ---
  if (selectedProject && viewMode === 'view') {
    const projectInfra = getProjectInfra(selectedProject)
    return (
      <PageLayout userInfo={userInfo} onLogout={handleLogout}>
        <main className="flex-1 overflow-y-auto bg-slate-50/50 backdrop-blur-3xl w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
            <button
              onClick={handleBackToCards}
              className="relative z-10 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 mb-6 transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to projects
            </button>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2 font-display">
                Manage Infrastructure
              </h1>
              <p className="text-sm text-slate-600 font-medium">
                Infrastructure details for project: <span className="text-blue-600 font-semibold">{selectedProject.project_name}</span>
              </p>
            </div>
            <InfrastructureView infrastructureList={projectInfra} />
          </div>
        </main>
      </PageLayout>
    )
  }

  // --- RENDER: Main Project Cards View ---
  return (
    <PageLayout userInfo={userInfo} onLogout={handleLogout}>
      <main className="flex-1 overflow-y-auto bg-slate-50/50 backdrop-blur-3xl w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          {/* Page Header with Search */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2 font-display">
                Infrastructure
              </h1>
              <p className="text-sm text-slate-600 font-medium">
                Manage infrastructure for your projects. Create and monitor cloud resources.
              </p>
            </div>

            {/* Search Field */}
            <div className="relative w-full md:w-80 flex-shrink-0 group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-[18px] w-[18px] text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3 text-sm bg-white/80 backdrop-blur-sm border border-slate-300 shadow-sm rounded-xl focus:outline-none placeholder:text-slate-600"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Loading State - Skeleton Scaffold */}
          {isLoadingProjects ? (
            <div className="space-y-4">
              {[1, 2, 3].map((skeleton) => (
                <div key={skeleton} className="glass-card rounded-md p-6 overflow-hidden relative">
                  {/* Shimmer animation */}
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-10"></div>

                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-0 opacity-60">
                    <div className="flex-1">
                      {/* Title & Badge */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-5 w-48 bg-slate-200/50 rounded-md"></div>
                        <div className="h-5 w-16 bg-slate-200/50 rounded-md"></div>
                      </div>

                      {/* Description */}
                      <div className="h-4 w-3/4 bg-slate-200/50 rounded-md mb-6"></div>

                      {/* Badges line */}
                      <div className="flex gap-2">
                        <div className="h-6 w-32 bg-slate-200/50 rounded-lg"></div>
                        <div className="h-6 w-24 bg-slate-200/50 rounded-lg"></div>
                      </div>
                    </div>

                    {/* Button skeleton */}
                    <div className="flex-shrink-0 self-center sm:self-start">
                      <div className="h-10 w-32 bg-slate-200/50 rounded-xl"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProjects.length > 0 ? (
            /* Project Cards */
            <motion.div
              className="space-y-4"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.1 }
                }
              }}
            >
              {filteredProjects.map((project, index) => {
                const envBadge = getEnvironmentBadge(project.environment)
                const projectInfra = getProjectInfra(project)
                const infraSummary = getInfraTypeSummary(projectInfra)

                return (
                  <motion.div
                    key={project.id || project.project_name || index}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0 }
                    }}
                  >
                    <div className={`group relative glass-card rounded-md p-6 border-l-[3px] transition-all duration-300 hover:shadow-[0_10px_40px_-5px_rgba(33,150,243,0.35)] hover:border-blue-500/80 hover:-translate-y-1 overflow-hidden ${envBadge.leftBorder}`}>
                      {/* Decorative glow */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                      {projectInfra.length > 0 ? (
                        <div className="relative z-10 flex flex-col h-full">

                          {/* Top Row: Name and Live Status */}
                          <div className="flex items-center justify-between border-b border-white/40 pb-4 mb-4">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors tracking-tight">
                                  {project.project_name}
                                </h3>
                                <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-md border ${envBadge.color}`}>
                                  {envBadge.label}
                                </span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 self-start mt-1 relative group/status cursor-default">
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-[pulse_2s_ease-in-out_infinite]"></span>
                                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest hidden sm:block">Active</span>
                              </div>
                            </div>
                          </div>

                          {/* Middle Area: Architecture Grid */}
                          <div className="mb-5 bg-slate-50/50 rounded-md p-4 border border-white/60 shadow-inner flex-1">
                            <div className="flex items-center justify-between mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <span>Provisioned Stack Architecture</span>
                              <span>{projectInfra.length} Node{projectInfra.length !== 1 && 's'}</span>
                            </div>

                            <div className="flex items-center overflow-x-auto pb-2 scrollbar-hide">
                              {projectInfra.map((infra, idx) => {
                                let IconTag = Cloud;
                                let colorStr = "text-blue-500";
                                let bgStr = "bg-white border-blue-100";
                                let labelStr = infra.infraType;

                                if (infra.infraType === 'network') { IconTag = Network; colorStr = "text-indigo-500"; bgStr = "bg-white border-indigo-100"; labelStr = "VPC Net"; }
                                else if (infra.infraType === 'servers') { IconTag = Server; colorStr = "text-violet-500"; bgStr = "bg-white border-violet-100"; labelStr = "Compute"; }
                                else if (infra.infraType === 'serverless') { IconTag = Activity; colorStr = "text-emerald-500"; bgStr = "bg-white border-emerald-100"; labelStr = "Serverless"; }
                                else if (infra.infraType === 'cloud-managed') { IconTag = Database; colorStr = "text-orange-500"; bgStr = "bg-white border-orange-100"; labelStr = "Managed Core"; }
                                else { labelStr = "AI Stack"; }

                                return (
                                  <div key={idx} className="flex items-center flex-shrink-0">
                                    <div className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-md border shadow-sm ${bgStr} min-w-[76px] transition-transform hover:-translate-y-0.5`}>
                                      <IconTag className={`w-5 h-5 ${colorStr}`} />
                                      <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[64px]">{labelStr}</span>
                                    </div>
                                    {idx < projectInfra.length - 1 && (
                                      <div className="w-5 flex items-center justify-center">
                                        <div className="w-full h-px bg-slate-300"></div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* Bottom Area: Actions */}
                          <div className="flex justify-end pt-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCreateInfra(project)}
                                className="group inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-md hover:from-blue-600 hover:to-blue-700 hover:shadow-[0_8px_20px_-6px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 border-none"
                              >
                                <svg className="w-4 h-4 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Infra
                              </button>
                              <button
                                onClick={() => handleManageInfra(project)}
                                className="group inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-md hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2 transition-all duration-300"
                              >
                                <svg className="w-4 h-4 text-slate-500 group-hover:text-slate-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Manage Infra
                              </button>
                              <button
                                onClick={() => handleDeleteInfra(project)}
                                className="group inline-flex items-center gap-1.5 px-3 py-2.5 bg-white border border-red-200 text-red-500 text-sm font-semibold rounded-md hover:bg-red-50 hover:border-red-300 hover:text-red-600 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2 transition-all duration-300"
                                title="Delete Infrastructure"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-base font-semibold text-slate-800 group-hover:text-blue-600 transition-colors tracking-tight truncate">
                                {project.project_name}
                              </h3>
                              <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-md border ${envBadge.color}`}>
                                {envBadge.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mt-2">
                              <LayoutTemplate className="w-4 h-4" />
                              <span>No infrastructure configured</span>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <button
                              onClick={() => handleCreateInfra(project)}
                              className="group inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-md hover:from-blue-600 hover:to-blue-700 hover:shadow-[0_8px_20px_-6px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 border-none"
                            >
                              <svg className="w-4 h-4 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Create Infra
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Divider Line */}
                    {index < filteredProjects.length - 1 && (
                      <div className="flex justify-center mt-4 mb-2 pointer-events-none opacity-60">
                        <div className="w-2/3 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </motion.div>
          ) : searchQuery ? (
            /* No Search Results State */
            <div className="glass-panel rounded-3xl p-16 text-center">
              <div className="max-w-sm mx-auto">
                <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">
                  No projects found
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  We couldn't find any projects matching "{searchQuery}".
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline transition-all"
                >
                  Clear search
                </button>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="glass-panel rounded-3xl p-16 text-center">
              <div className="max-w-sm mx-auto">
                <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">
                  No projects yet
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  Create a project from the Dashboard first, then come back to set up infrastructure.
                </p>
                <a
                  href="/home"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 hover:shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Go to Dashboard
                </a>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Delete Modal */}
      {deletingProject && (
        <DeleteInfraModal
          project={deletingProject}
          onClose={() => setDeletingProject(null)}
          onDeletedAll={handleDeletedAll}
          onInfraUpdated={handleInfraUpdated}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </PageLayout>
  )
}

export default InfrastructurePage
