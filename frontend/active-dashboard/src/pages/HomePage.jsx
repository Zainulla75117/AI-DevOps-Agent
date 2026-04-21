import { useEffect, useState, useRef } from 'react'
import { fetchProjects, deleteProject } from '../services/projectService'
import { useAuth } from '../hooks/useAuth'
import PageLayout from '../components/PageLayout'
import ProjectCreate from '../components/ProjectCreate'
import Toast from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import { motion } from 'framer-motion'

const HomePage = () => {
  const { userInfo, handleLogout } = useAuth()
  const [projects, setProjects] = useState([])
  const [filteredProjects, setFilteredProjects] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [selectedProject, setSelectedProject] = useState(null)
  const [showProjectDetails, setShowProjectDetails] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [toast, setToast] = useState(null)
  const [projectToDelete, setProjectToDelete] = useState(null)
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    document.title = 'infraXai - Project Canvas'
  }, [])

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true
      loadProjects()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Filter projects based on search query
    if (!searchQuery.trim()) {
      setFilteredProjects(projects)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredProjects(
        projects.filter(
          (project) =>
            project.project_name?.toLowerCase().includes(query) ||
            project.description?.toLowerCase().includes(query)
        )
      )
    }
  }, [searchQuery, projects])

  const loadProjects = async () => {
    setIsLoadingProjects(true)
    try {
      const projectsArray = await fetchProjects()
      const projectsList = Array.isArray(projectsArray) ? projectsArray : []
      setProjects(projectsList)
      setFilteredProjects(projectsList)
    } catch (error) {
      setToast({
        message: error.message || 'Failed to load projects',
        type: 'error',
      })
      setProjects([])
      setFilteredProjects([])
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const handleProjectCreated = (project, responseMessage) => {
    loadProjects()
    setShowCreateForm(false) // Hide form after successful creation
    setToast({
      message: responseMessage || 'Project created successfully!',
      type: 'success',
    })
  }

  const handleMenuClick = (project, e) => {
    e.stopPropagation()
    setSelectedProject(project)
    setShowProjectDetails(true)
  }

  const handleCloseProjectDetails = () => {
    setShowProjectDetails(false)
    setSelectedProject(null)
  }

  const handleDeleteProject = (project, e) => {
    e.stopPropagation()
    setProjectToDelete(project)
  }

  const confirmDelete = async () => {
    if (!projectToDelete) return

    try {
      await deleteProject(projectToDelete.id)
      setToast({ message: 'Project deleted successfully!', type: 'success' })
      loadProjects()
    } catch (error) {
      setToast({ message: error.message || 'Failed to delete project', type: 'error' })
    } finally {
      setProjectToDelete(null)
    }
  }

  const getProjectTypeLabel = (project) => {
    // Map project data to display type
    if (project.domain === 'web') return 'Web Application'
    if (project.domain === 'api') return 'Backend API'
    if (project.domain === 'microservices') return 'Microservices'
    if (project.domain === 'data') return 'Data / Pipeline'

    // Fallbacks
    if (project.domain) return 'Web Application'
    if (project.platform === 'cloud') return 'Backend API'
    return 'Microservices'
  }

  const getEnvironmentBadge = (env) => {
    const envLower = env?.toLowerCase() || ''
    if (envLower.includes('dev') || envLower === 'development') {
      return { label: 'Dev', color: 'bg-blue-50 text-blue-700 border-blue-200' }
    }
    if (envLower.includes('qa') || envLower === 'testing' || envLower === 'staging') {
      return { label: 'QA', color: 'bg-amber-50 text-amber-700 border-amber-200' }
    }
    if (envLower.includes('prod') || envLower === 'production') {
      return { label: 'Prod', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    }
    return { label: env || 'Unknown', color: 'bg-slate-50 text-slate-700 border-slate-200' }
  }

  const formatLastUpdated = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <PageLayout userInfo={userInfo} onLogout={handleLogout}>
      <main className="flex-1 overflow-y-auto bg-slate-50/50 backdrop-blur-3xl w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2 font-display">
              Project Canvas
            </h1>
            <p className="text-sm text-slate-600 font-medium">
              Define what you're building. Infrastructure comes next.
            </p>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8">
            {/* Left Section - Project Overview */}
            <div className="space-y-6">
              {/* Search Field */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-[18px] w-[18px] text-slate-500 group-focus-within:text-blue-600 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search projects…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 text-sm bg-white/80 backdrop-blur-sm border border-white shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-300 placeholder:text-slate-400"
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

              {/* Projects List */}
              {isLoadingProjects ? (
                <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 border-4 border-blue-100 rounded-full"></div>
                      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-900">Loading projects</p>
                      <p className="text-xs text-slate-500 mt-1">Please wait...</p>
                    </div>
                  </div>
                </div>
              ) : filteredProjects.length > 0 ? (
                <motion.div 
                  className="space-y-4"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.08 }
                    }
                  }}
                >
                  {filteredProjects.map((project, index) => {
                    const envBadge = getEnvironmentBadge(project.environment)

                    return (
                      <motion.div
                        key={project.id || project.project_name || index}
                        variants={{
                          hidden: { opacity: 0, y: 20 },
                          visible: { opacity: 1, y: 0 }
                        }}
                        className="group relative glass-card rounded-xl p-6 transition-all duration-300 hover:shadow-[0_10px_40px_-5px_rgba(33,150,243,0.35)] hover:border-blue-500/80 hover:-translate-y-1 cursor-pointer overflow-hidden"
                      >
                        {/* Decorative glow effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                        <div className="relative z-10 flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2.5">
                              <h3 className="text-base font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                {project.project_name}
                              </h3>
                              <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${envBadge.color} whitespace-nowrap`}>
                                {envBadge.label}
                              </span>
                            </div>

                            {project.description && (
                              <p className="text-sm text-slate-600 mb-3 line-clamp-2 leading-relaxed">
                                {project.description}
                              </p>
                            )}

                            <div className="flex items-center gap-5 text-xs text-slate-500">
                              <span className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                {getProjectTypeLabel(project)}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Updated {formatLastUpdated(project.updated_at || project.created_at)}
                              </span>
                            </div>
                          </div>

                          {/* Quick Actions - Show on Hover */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={(e) => handleMenuClick(project, e)}
                              className="p-2 text-blue-900/60 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all duration-150"
                              title="View Details"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              className="p-2 text-blue-900/60 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all duration-150"
                              title="Edit Project"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              className="p-2 text-blue-900/60 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-all duration-150"
                              title="Infrastructure"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => handleDeleteProject(project, e)}
                              className="p-2 text-red-900/60 hover:text-red-900 hover:bg-red-50 rounded-lg transition-all duration-150"
                              title="Delete Project"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              ) : (
                <div className="glass-panel rounded-3xl border border-white p-16 text-center">
                  <div className="max-w-sm mx-auto">
                    <div className="w-16 h-16 mx-auto mb-4 bg-slate-100/80 rounded-2xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 mb-1">
                      {searchQuery ? 'No projects found' : 'No projects yet'}
                    </h3>
                    <p className="text-sm text-slate-500 mb-6">
                      {searchQuery
                        ? 'Try adjusting your search terms'
                        : 'Get started by creating your first project'}
                    </p>
                    {!searchQuery && !showCreateForm && (
                      <button
                        onClick={() => setShowCreateForm(true)}
                        className="inline-flex items-center gap-2 py-3 text-slate-800 text-sm font-semibold hover:text-blue-600 hover:-translate-y-0.5 focus:outline-none transition-all duration-300"
                      >
                        <img src="/add_project_icon.png" alt="Create Project" className="w-8 h-8 object-contain" />
                        Create Project
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Section - Create Project Panel */}
            <div className="xl:sticky xl:top-8 h-fit">
              {showCreateForm ? (
                <ProjectCreate
                  onProjectCreated={handleProjectCreated}
                  onCancel={() => setShowCreateForm(false)}
                />
              ) : (
                <div className="glass-panel rounded-2xl border border-white p-8 transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(33,150,243,0.1)] hover:border-blue-200/50">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center">
                      <img src="/add_project_icon.png" alt="Create Project" className="w-14 h-14 object-contain drop-shadow-md" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 mb-1">Create New Project</h3>
                    <p className="text-sm text-slate-500 mb-6">
                      Start building your infrastructure
                    </p>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="w-full px-4 py-3.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 hover:shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300"
                    >
                      Get Started
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Project Details Modal */}
      {showProjectDetails && selectedProject && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={handleCloseProjectDetails}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-900">Project Details</h3>
              <button
                onClick={handleCloseProjectDetails}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Project Name</label>
                  <p className="text-sm font-semibold text-slate-900">{selectedProject.project_name}</p>
                </div>
                {selectedProject.id && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Project ID</label>
                    <p className="text-xs text-slate-600 font-mono bg-slate-50 px-2 py-1 rounded">{selectedProject.id}</p>
                  </div>
                )}
                {selectedProject.domain && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Domain</label>
                    <p className="text-sm font-medium text-slate-900">{selectedProject.domain}</p>
                  </div>
                )}
                {selectedProject.platform && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Platform</label>
                    <p className="text-sm font-medium text-slate-900 capitalize">{selectedProject.platform}</p>
                  </div>
                )}
                {selectedProject.cloud_provider && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Cloud Provider</label>
                    <p className="text-sm font-medium text-slate-900 uppercase">{selectedProject.cloud_provider}</p>
                  </div>
                )}
                {selectedProject.region && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Region</label>
                    <p className="text-sm font-medium text-slate-900">{selectedProject.region}</p>
                  </div>
                )}
                {selectedProject.environment && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Environment</label>
                    <p className="text-sm font-medium text-slate-900 capitalize">{selectedProject.environment}</p>
                  </div>
                )}
                {selectedProject.created_at && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Created At</label>
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(selectedProject.created_at).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
                {selectedProject.updated_at && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Updated At</label>
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(selectedProject.updated_at).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
              {selectedProject.description && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Description</label>
                  <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 leading-relaxed">
                    {selectedProject.description}
                  </p>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end rounded-b-2xl">
              <button
                onClick={handleCloseProjectDetails}
                className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!projectToDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${projectToDelete?.project_name}"? This action cannot be undone and will permanently remove all associated configurations.`}
        confirmText="Delete Project"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setProjectToDelete(null)}
        isDestructive={true}
      />
    </PageLayout>
  )
}

export default HomePage
