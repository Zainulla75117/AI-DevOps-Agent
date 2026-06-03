import { useEffect, useState, useRef } from 'react'
import { fetchProjects, updateProject } from '../services/projectService'
import { getSCMRepos } from '../services/credentialService'
import { useAuth } from '../hooks/useAuth'
import useInfrastructure from '../hooks/useInfrastructure'
import PageLayout from '../components/PageLayout'
import InfraChatInterface from '../components/InfraChatInterface'

import DeleteInfraModal from '../components/DeleteInfraModal'
import Toast from '../components/Toast'
import { motion } from 'framer-motion'
import InfrastructureTopologyModal from '../components/InfrastructureTopologyModal'

import ProjectInfraCard from '../components/infra/ProjectInfraCard'
import RepoSelector from '../components/infra/RepoSelector'

// ── Utility helpers ──────────────────────────────────────────────────

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

// ── Main Component ───────────────────────────────────────────────────

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
  const [deletingProject, setDeletingProject] = useState(null)
  const [collapsedProjects, setCollapsedProjects] = useState({})
  const [topologyProject, setTopologyProject] = useState(null)

  const toggleCollapse = (e, projectId) => {
    e.stopPropagation()
    setCollapsedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }))
  }

  // Infrastructure hook
  const {
    fetchInfraForProjects,
    refreshInfraForProject,
    getProjectInfra,
    getInfraTypeSummary,
    handleInfraUpdated,
    handleDeletedAll,
  } = useInfrastructure()

  // Repo Linking State
  const [scmRepos, setScmRepos] = useState([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [isUpdatingProject, setIsUpdatingProject] = useState(false)

  const [toast, setToast] = useState(null)
  const hasFetchedRef = useRef(false)

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
    if (selectedProject && !selectedRepo && !isRepoSelectionSkipped) {
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
  }, [selectedProject, selectedRepo, isRepoSelectionSkipped])

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

  // ── Action Handlers ────────────────────────────────────────────────

  const handleCreateInfra = (project) => {
    setSelectedProject(project)
    setSelectedRepo(null)
    setIsRepoSelectionSkipped(false)
  }

  const handleDeleteInfra = (project) => {
    setDeletingProject(project)
  }

  const onInfraUpdated = (freshData) => {
    handleInfraUpdated(freshData, deletingProject)
  }

  const onDeletedAll = () => {
    const projectName = deletingProject?.project_name
    handleDeletedAll(deletingProject)
    setToast({ message: `All infrastructure for "${projectName}" has been wiped. AI memory and history have been archived.`, type: 'success' })
    setDeletingProject(null)
  }

  // Back Navigation Handlers
  const handleBackToCards = () => {
    setSelectedProject(null)
    setSelectedRepo(null)
    setIsRepoSelectionSkipped(false)
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

  // Repo selection handler (delegates linking logic)
  const handleSelectRepo = async (repo, isLinked, linkedRepos) => {
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
  }

  // --- RENDER: AI Chat Interface ---
  if (selectedProject && (selectedRepo || isRepoSelectionSkipped)) {
    return (
      <PageLayout userInfo={userInfo} onLogout={handleLogout}>
        <main className="flex-1 overflow-y-auto bg-slate-50/50 backdrop-blur-3xl w-full">
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-6">
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
  if (selectedProject && !selectedRepo && !isRepoSelectionSkipped) {
    return (
      <PageLayout userInfo={userInfo} onLogout={handleLogout}>
        <main className="flex-1 overflow-y-auto bg-slate-50/50 backdrop-blur-3xl w-full">
          <RepoSelector
            selectedProject={selectedProject}
            scmRepos={scmRepos}
            isLoadingRepos={isLoadingRepos}
            isUpdatingProject={isUpdatingProject}
            onSelectRepo={handleSelectRepo}
            onSkip={() => setIsRepoSelectionSkipped(true)}
            onBack={handleBackToCards}
            getProviderIcon={getProviderIcon}
          />
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
                    <ProjectInfraCard
                      project={project}
                      projectInfra={projectInfra}
                      infraSummary={infraSummary}
                      collapsedProjects={collapsedProjects}
                      onToggleCollapse={toggleCollapse}
                      onCreateInfra={handleCreateInfra}
                      onDeleteInfra={handleDeleteInfra}
                      onViewTopology={(project) => setTopologyProject(project)}
                      getEnvironmentBadge={getEnvironmentBadge}
                    />

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
          onDeletedAll={onDeletedAll}
          onInfraUpdated={onInfraUpdated}
        />
      )}

      {/* Topology Modal */}
      {topologyProject && (
        <InfrastructureTopologyModal
          project={topologyProject}
          projectInfra={getProjectInfra(topologyProject)}
          onClose={() => setTopologyProject(null)}
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
