import { Network, LayoutTemplate } from 'lucide-react'
import ArchitectureGrid from './ArchitectureGrid'

/**
 * ProjectInfraCard — Renders a single project card in the infrastructure list.
 * Handles both the "has infrastructure" and "no infrastructure" variants.
 *
 * Props:
 *  - project: The project object
 *  - projectInfra: Array of infra items for this project
 *  - infraSummary: Array of type labels (unused in render but available)
 *  - collapsedProjects: Object map of collapsed state by project id
 *  - onToggleCollapse: (e, projectId) => void
 *  - onCreateInfra: (project) => void
 *  - onDeleteInfra: (project) => void
 *  - onViewTopology: (project) => void
 *  - getEnvironmentBadge: (env) => { label, color, leftBorder }
 */
const ProjectInfraCard = ({
  project,
  projectInfra,
  infraSummary,
  collapsedProjects,
  onToggleCollapse,
  onCreateInfra,
  onDeleteInfra,
  onViewTopology,
  getEnvironmentBadge,
}) => {
  const envBadge = getEnvironmentBadge(project.environment)
  const projectId = project.id || project.project_name
  const isCollapsed = collapsedProjects[projectId]

  return (
    <div className="group relative bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1 overflow-hidden">

      {projectInfra.length > 0 ? (
        <div className="relative z-10 flex flex-col h-full">

          {/* Top Row: Name and Live Status */}
          <div className="flex items-center justify-between pb-5 mb-5 border-b border-slate-100 cursor-pointer group/header" onClick={(e) => onToggleCollapse(e, projectId)}>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <h3 className="text-3xl font-extrabold font-brand tracking-tighter text-slate-900 group-hover/header:text-blue-600 transition-colors">
                  {project.project_name}
                </h3>
                <span className={`px-2.5 py-0.5 text-[10px] uppercase tracking-wide font-semibold rounded-full border ${envBadge.color}`}>
                  {envBadge.label}
                </span>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center gap-8 hidden lg:flex opacity-90 mx-6">
                <div className="flex flex-col items-start min-w-[80px]">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Health</span>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${projectInfra.length > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                    <span className={`text-sm font-semibold ${projectInfra.length > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {projectInfra.length > 0 ? 'Optimal' : 'Standby'}
                    </span>
                  </div>
                </div>
                <div className="w-px h-8 bg-slate-100"></div>
                <div className="flex flex-col items-start min-w-[80px]">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Nodes</span>
                  <span className="text-sm font-semibold font-mono text-slate-700">
                    {projectInfra.length.toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="w-px h-8 bg-slate-100"></div>
                <div className="flex flex-col items-start min-w-[80px]">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Est. Cost</span>
                  <span className="text-sm font-semibold font-mono text-slate-700">
                    ${(projectInfra.length * 18.5).toFixed(2)}<span className="text-xs text-slate-400 font-sans ml-0.5">/mo</span>
                  </span>
                </div>
            </div>

            <div className="flex-shrink-0 flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); onCreateInfra(project); }}
                className="group mr-2 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 border border-blue-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95"
              >
                <svg className="w-4 h-4 text-blue-200 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Chat with AI
              </button>
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100 mr-2">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </div>
                <span className="text-[11px] font-bold tracking-wide">Active</span>
              </div>



              <div className="w-8 h-8 ml-1 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover/header:bg-blue-50 group-hover/header:text-blue-600 transition-colors">
                <svg className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {!isCollapsed && (
            <>

          {/* Middle Area: Architecture Grid */}
          <div className="mb-6 bg-slate-50/80 rounded-xl p-5 border border-slate-100 flex-1 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Provisioned Architecture</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">{projectInfra.length} Node{projectInfra.length !== 1 && 's'}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); onViewTopology(project); }}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded-md border border-purple-200 transition-colors shadow-sm"
                >
                  <Network className="w-3 h-3" />
                  View Topology Map
                </button>
              </div>
            </div>

            <ArchitectureGrid infraItems={projectInfra} />
          </div>

          <div className="flex justify-end pt-2">
            <button
                onClick={(e) => { e.stopPropagation(); onDeleteInfra(project); }}
                className="group inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-red-200 text-red-500 text-sm font-semibold rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2"
                title="Delete Infrastructure"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Stack
            </button>
          </div>
            </>
          )}
        </div>
      ) : (
        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between pb-5 border-b border-slate-100 cursor-pointer group/header" onClick={(e) => onToggleCollapse(e, projectId)}>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <h3 className="text-3xl font-extrabold font-brand tracking-tighter text-slate-900 group-hover/header:text-blue-600 transition-colors">
                  {project.project_name}
                </h3>
                <span className={`px-2.5 py-0.5 text-[10px] uppercase tracking-wide font-semibold rounded-full border ${envBadge.color}`}>
                  {envBadge.label}
                </span>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center gap-8 hidden lg:flex opacity-90 mx-6">
                <div className="flex flex-col items-start min-w-[80px]">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Health</span>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${projectInfra.length > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                    <span className={`text-sm font-semibold ${projectInfra.length > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {projectInfra.length > 0 ? 'Optimal' : 'Standby'}
                    </span>
                  </div>
                </div>
                <div className="w-px h-8 bg-slate-100"></div>
                <div className="flex flex-col items-start min-w-[80px]">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Nodes</span>
                  <span className="text-sm font-semibold font-mono text-slate-700">
                    {projectInfra.length.toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="w-px h-8 bg-slate-100"></div>
                <div className="flex flex-col items-start min-w-[80px]">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Est. Cost</span>
                  <span className="text-sm font-semibold font-mono text-slate-700">
                    ${(projectInfra.length * 18.5).toFixed(2)}<span className="text-xs text-slate-400 font-sans ml-0.5">/mo</span>
                  </span>
                </div>
            </div>

            <div className="flex-shrink-0 flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); onCreateInfra(project); }}
                className="group mr-2 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 border border-blue-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95"
              >
                <svg className="w-4 h-4 text-blue-200 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Chat with AI
              </button>
              <div className="w-8 h-8 ml-1 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover/header:bg-blue-50 group-hover/header:text-blue-600 transition-colors">
                <svg className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {!isCollapsed && (
            <div className="flex items-center justify-center py-6 bg-slate-50/50 rounded-xl border border-slate-100 border-dashed mt-4">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-lg border border-slate-200 text-slate-500 shadow-sm">
                <LayoutTemplate className="w-4 h-4" />
                <span className="text-sm font-semibold">No infrastructure configured</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ProjectInfraCard
