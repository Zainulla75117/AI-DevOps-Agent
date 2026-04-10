import { useEffect, useState, useRef } from 'react'
import { fetchProjects } from '../services/projectService'
import { useAuth } from '../hooks/useAuth'
import PageLayout from '../components/PageLayout'
import InfrastructureCreate from '../components/InfrastructureCreate'
import InfraChatInterface from '../components/InfraChatInterface'
import InfrastructureView from '../components/InfrastructureView'
import Toast from '../components/Toast'

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
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [selectedProject, setSelectedProject] = useState(null)
  
  // New workflow states
  const [creationMethod, setCreationMethod] = useState(null) // 'ai' | 'manual' | null
  const [selectedInfraType, setSelectedInfraType] = useState(null)
  const [viewMode, setViewMode] = useState(null) // 'view' | null
  
  const [infrastructureMap, setInfrastructureMap] = useState(loadInfraMap)
  const [toast, setToast] = useState(null)
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    document.title = 'DevOps Infinity - Infrastructure'
  }, [])

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true
      loadProjects()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadProjects = async () => {
    setIsLoadingProjects(true)
    try {
      const projectsArray = await fetchProjects()
      const projectsList = Array.isArray(projectsArray) ? projectsArray : []
      setProjects(projectsList)
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

  const getProjectTypeLabel = (project) => {
    if (project.domain === 'web') return 'Web Application'
    if (project.domain === 'api') return 'Backend API'
    if (project.domain === 'microservices') return 'Microservices'
    if (project.domain === 'data') return 'Data / Pipeline'
    if (project.domain) return 'Web Application'
    return 'Project'
  }

  const infraTypes = [
    {
      value: 'network',
      label: 'Network',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
      description: 'VPC, subnets, gateways',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      value: 'servers',
      label: 'Servers',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      ),
      description: 'EC2, compute instances',
      gradient: 'from-violet-500 to-purple-500',
    },
    {
      value: 'serverless',
      label: 'Serverless',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      ),
      description: 'Lambda, functions',
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      value: 'cloud-managed',
      label: 'Cloud Managed',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
      description: 'RDS, S3, managed services',
      gradient: 'from-orange-500 to-amber-500',
    },
  ]

  const handleCreateInfra = (project) => {
    setSelectedProject(project)
    setCreationMethod(null) // Start with method selection
    setSelectedInfraType(null)
  }
  
  const handleMethodSelect = (method) => {
    setCreationMethod(method)
  }

  const handleInfraTypeSelect = (type) => {
    setSelectedInfraType(type)
  }

  const handleManageInfra = (project) => {
    setSelectedProject(project)
    setViewMode('view')
  }

  const handleDeleteInfra = (project) => {
    const projectId = project.id || project.project_name
    setInfrastructureMap((prev) => {
      const updated = { ...prev }
      delete updated[projectId]
      saveInfraMap(updated)
      return updated
    })
    setToast({ message: `Infrastructure for "${project.project_name}" deleted successfully.`, type: 'success' })
  }

  // Back Navigation Handlers
  const handleBackToCards = () => {
    setSelectedProject(null)
    setCreationMethod(null)
    setSelectedInfraType(null)
    setViewMode(null)
  }
  
  const handleBackToMethodPicker = () => {
    setCreationMethod(null)
    setSelectedInfraType(null)
  }

  const handleBackToTypePicker = () => {
    setSelectedInfraType(null)
  }

  const handleInfrastructureCreated = (infraData, message) => {
    const projectId = selectedProject?.id || selectedProject?.project_name
    if (projectId) {
      setInfrastructureMap((prev) => {
        const existing = prev[projectId] || []
        const updated = {
          ...prev,
          [projectId]: [
            ...existing,
            {
              ...infraData,
              infraType: selectedInfraType || 'auto', // If AI, might not have selectedInfraType
              createdAt: new Date().toISOString(),
            },
          ],
        }
        saveInfraMap(updated)
        return updated
      })
    }
    setToast({ message: message || 'Infrastructure created successfully!', type: 'success' })
    setSelectedProject(null)
    setCreationMethod(null)
    setSelectedInfraType(null)
  }

  const getProjectInfra = (project) => {
    const projectId = project.id || project.project_name
    return infrastructureMap[projectId] || []
  }

  const getInfraTypeSummary = (infraItems) => {
    if (!infraItems || infraItems.length === 0) return null
    const types = infraItems.map((i) => {
      const found = infraTypes.find((t) => t.value === i.infraType)
      return found?.label || (i.infraType === 'auto' ? 'AI Provisioned' : i.infraType || i.type || 'Unknown')
    })
    return [...new Set(types)]
  }

  // --- RENDER: AI Chat Interface ---
  if (selectedProject && creationMethod === 'ai') {
    return (
      <PageLayout userInfo={userInfo} onLogout={handleLogout}>
        <main className="flex-1 overflow-y-auto bg-slate-50/50 backdrop-blur-3xl w-full">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
            <InfraChatInterface 
               project={selectedProject} 
               onCancel={handleBackToMethodPicker} 
               onInfrastructureCreated={handleInfrastructureCreated} 
            />
          </div>
        </main>
      </PageLayout>
    )
  }

  // --- RENDER: Creation Method Picker ---
  if (selectedProject && !creationMethod) {
    return (
      <PageLayout userInfo={userInfo} onLogout={handleLogout}>
        <main className="flex-1 overflow-y-auto bg-slate-50/50 backdrop-blur-3xl w-full">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
            {/* Back navigation */}
            <button
              onClick={handleBackToCards}
              className="relative z-10 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 mb-6 transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to projects
            </button>

            {/* Header */}
            <div className="mb-10 text-center">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">
                How would you like to build?
              </h1>
              <p className="text-base text-slate-600 font-medium">
                Choose your infrastructure provisioning method for <span className="text-blue-600 font-semibold">{selectedProject.project_name}</span>
              </p>
            </div>

            {/* Method Picker Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              
              {/* Option 1: AI Assisted */}
              <button
                onClick={() => handleMethodSelect('ai')}
                className="group relative rounded-lg shadow-lg hover:shadow-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 text-left min-h-[420px]"
              >
                <img src="/Ai_bot.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/80 via-indigo-900/60 to-purple-900/70 group-hover:from-indigo-900/70 group-hover:to-purple-900/60 transition-all duration-500"></div>
                <div className="relative p-8 sm:p-10">
                  <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mb-6 shadow-md transition-transform duration-500 group-hover:scale-110">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2a1 1 0 011 1v1a1 1 0 01-2 0V3a1 1 0 011-1zM4 9h16a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6a2 2 0 012-2zm4 4a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2zm-6 5v2m4-2v2" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-indigo-200 transition-colors">
                    Copilot-Assisted Provisioning
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed font-medium mb-8">
                    Let our DevOps AI analyze your project requirements and automatically generate the optimal cloud infrastructure architecture for you in seconds.
                  </p>
                  
                  <div className="flex items-center text-indigo-300 font-semibold group-hover:text-white transition-colors">
                    <span>Start Chatting</span>
                    <svg className="w-4 h-4 ml-1.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Option 2: Manual */}
              <button
                onClick={() => handleMethodSelect('manual')}
                className="group relative rounded-lg shadow-lg hover:shadow-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 text-left min-h-[420px]"
              >
                <img src="/form_bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/70 group-hover:from-slate-900/70 group-hover:to-slate-800/60 transition-all duration-500"></div>
                <div className="relative p-8 sm:p-10">
                  <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mb-6 shadow-md transition-transform duration-500 group-hover:scale-110">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-slate-200 transition-colors">
                    Manual Configuration
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed font-medium mb-8">
                    Take full control of your stack. Use our visual form builders to meticulously configure your Networks, Servers, and Databases exactly how you want.
                  </p>
                  
                  <div className="flex items-center text-slate-300 font-semibold group-hover:text-white transition-colors">
                    <span>Open Form Builder</span>
                    <svg className="w-4 h-4 ml-1.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </main>
      </PageLayout>
    )
  }

  // --- RENDER: InfrastructureCreate form ---
  if (selectedProject && creationMethod === 'manual' && selectedInfraType) {
    return (
      <PageLayout userInfo={userInfo} onLogout={handleLogout}>
        <main className="flex-1 overflow-y-auto bg-slate-50/50 backdrop-blur-3xl w-full">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
            {/* Back navigation */}
            <button
              onClick={handleBackToTypePicker}
              className="relative z-10 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 mb-6 transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to type selection
            </button>

            <InfrastructureCreate
              selectedOption={selectedInfraType}
              preSelectedProject={selectedProject.project_name}
              onInfrastructureCreated={handleInfrastructureCreated}
              onCancel={handleBackToTypePicker}
            />
          </div>
        </main>

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

  // --- RENDER: Infra Type Picker ---
  if (selectedProject && creationMethod === 'manual' && !selectedInfraType) {
    return (
      <PageLayout userInfo={userInfo} onLogout={handleLogout}>
        <main className="flex-1 overflow-y-auto bg-slate-50/50 backdrop-blur-3xl w-full">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
            {/* Back navigation */}
            <button
              onClick={handleBackToMethodPicker}
              className="relative z-10 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 mb-6 transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to method selection
            </button>

            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
                Create Infrastructure
              </h1>
              <p className="text-sm text-slate-600 font-medium">
                For project: <span className="text-blue-600 font-semibold">{selectedProject.project_name}</span>
              </p>
            </div>

            {/* Infra Type Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {infraTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleInfraTypeSelect(type.value)}
                  className="group relative bg-white/60 backdrop-blur-md rounded-2xl border border-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.03)] p-6 transition-all duration-300 hover:border-blue-200/60 hover:shadow-[0_8px_30px_-4px_rgba(33,150,243,0.15)] hover:-translate-y-1 cursor-pointer text-left overflow-hidden"
                >
                  {/* Decorative glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  <div className="relative">
                    {/* Icon with gradient bg */}
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.gradient} flex items-center justify-center text-white mb-4 shadow-sm group-hover:shadow-md transition-shadow duration-300`}>
                      {type.icon}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                      {type.label}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {type.description}
                    </p>

                    {/* Arrow */}
                    <div className="mt-4 flex items-center text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="text-xs font-semibold">Configure</span>
                      <svg className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
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
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
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
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
              Infrastructure
            </h1>
            <p className="text-sm text-slate-600 font-medium">
              Manage infrastructure for your projects. Create and monitor cloud resources.
            </p>
          </div>

          {/* Loading State */}
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
          ) : projects.length > 0 ? (
            /* Project Cards */
            <div className="space-y-4">
              {projects.map((project, index) => {
                const envBadge = getEnvironmentBadge(project.environment)
                const projectInfra = getProjectInfra(project)
                const infraSummary = getInfraTypeSummary(projectInfra)

                return (
                  <div
                    key={project.id || project.project_name || index}
                    className="group relative bg-white/60 backdrop-blur-md rounded-2xl border border-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.03)] p-6 transition-all duration-300 hover:border-blue-200/60 hover:shadow-[0_8px_30px_-4px_rgba(33,150,243,0.15)] overflow-hidden"
                  >
                    {/* Decorative glow */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Left: Project Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-base font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                            {project.project_name}
                          </h3>
                          <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${envBadge.color} whitespace-nowrap`}>
                            {envBadge.label}
                          </span>
                        </div>

                        {project.description && (
                          <p className="text-sm text-slate-600 mb-3 line-clamp-1 leading-relaxed">
                            {project.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                          <span className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            {getProjectTypeLabel(project)}
                          </span>
                        </div>

                        {/* Infrastructure Status */}
                        {projectInfra.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Infrastructure created
                            </span>
                            {infraSummary && infraSummary.map((type) => (
                              <span key={type} className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                                {type}
                              </span>
                            ))}
                            {projectInfra.some((i) => i.infraType === 'network' || i.infraType === 'auto') && (
                              <span className="text-xs text-slate-500">
                                {projectInfra
                                  .filter((i) => i.infraType === 'network' || i.infraType === 'auto')
                                  .map((i) => `${i.vpc_name || i.vpcName || i.data?.vpcName || 'VPC'} (${i.vpc_cidr || i.vpcCidr || i.data?.vpcCidr || ''})`)
                                  .join(', ')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <span className="font-medium">No infrastructure created.</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Action Button */}
                      <div className="flex-shrink-0 self-center sm:self-start">
                        {projectInfra.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleManageInfra(project)}
                              className="group inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2 transition-all duration-300"
                            >
                              <svg className="w-4 h-4 text-slate-500 group-hover:text-slate-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              Manage Infra
                            </button>
                            <button
                              onClick={() => handleDeleteInfra(project)}
                              className="group inline-flex items-center gap-1.5 px-3 py-2.5 bg-white border border-red-200 text-red-500 text-sm font-semibold rounded-xl hover:bg-red-50 hover:border-red-300 hover:text-red-600 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2 transition-all duration-300"
                              title="Delete Infrastructure"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCreateInfra(project)}
                            className="group inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 hover:shadow-[0_8px_20px_-6px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300 border-none"
                          >
                            <svg className="w-4 h-4 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create Infra
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-white shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] p-16 text-center">
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
