import { useState } from 'react'

/**
 * RepoSelector — Repository selection screen for linking repos to a project before chat.
 *
 * Props:
 *  - selectedProject: The project being configured
 *  - scmRepos: Array of available SCM repositories
 *  - isLoadingRepos: Boolean loading state
 *  - isUpdatingProject: Boolean updating state
 *  - onSelectRepo: (repo, isLinked, linkedRepos) => void — called when a repo row is clicked
 *  - onSkip: () => void — called when "Skip repository selection" is clicked
 *  - onBack: () => void — called when "Back to projects" is clicked
 *  - getProviderIcon: (provider) => ReactNode — renders SCM provider icon
 */
const RepoSelector = ({
  selectedProject,
  scmRepos,
  isLoadingRepos,
  isUpdatingProject,
  onSelectRepo,
  onSkip,
  onBack,
  getProviderIcon,
}) => {
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const linkedRepos = selectedProject.linked_repositories || []

  // Filter repos based on whether they are linked
  const linkedScmRepos = scmRepos.filter(repo =>
    linkedRepos.some(lr => lr.repo_full_name === repo.name_with_namespace)
  )

  // Filter repos for the "Add Repository" modal
  const unlinkedScmRepos = scmRepos.filter(repo =>
    !linkedRepos.some(lr => lr.repo_full_name === repo.name_with_namespace) &&
    (repo.name_with_namespace || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
      <button
        onClick={onBack}
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

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-905 text-slate-800">Linked Repositories</h2>
        {!isLoadingRepos && scmRepos.length > 0 && (
          <button
            onClick={() => {
              setSearchTerm('')
              setShowAddModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Repository
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        {isLoadingRepos ? (
          <div className="flex flex-col items-center justify-center p-12">
            <span className="w-8 h-8 border-4 border-blue-400 border-t-blue-600 rounded-full animate-spin mb-4"></span>
            <p className="text-slate-500 font-medium">Loading repositories...</p>
          </div>
        ) : linkedScmRepos.length > 0 ? (
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {linkedScmRepos.map((repo, idx) => {
              const isLinked = linkedRepos.some(lr => lr.repo_full_name === repo.name_with_namespace)
              return (
                <button
                  key={idx}
                  disabled={isUpdatingProject}
                  onClick={() => onSelectRepo(repo, isLinked, linkedRepos)}
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
        ) : scmRepos.length > 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-slate-100">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No Repositories Linked</h3>
            <p className="text-slate-500 max-w-sm mx-auto mb-6">
              You haven't linked any repositories to this project yet. Link a repository to enable AI infrastructure code analysis.
            </p>
            <button
              onClick={() => {
                setSearchTerm('')
                setShowAddModal(true)
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Link a Repository
            </button>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-slate-100">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No Repositories Synced</h3>
            <p className="text-slate-500 max-w-sm mx-auto mb-6">
              You haven't synced any SCM repositories yet. Go to Settings to connect GitHub, GitLab, or Bitbucket.
            </p>
            <a
              href="/settings"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
            >
              Go to Settings
            </a>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center justify-center gap-4">
        <button
          onClick={onSkip}
          className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
        >
          Skip repository selection
        </button>
      </div>

      {/* Link Repository Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-display">Link Repositories</h3>
                <p className="text-sm text-slate-500">Connect a synced SCM repository to this project</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Filter */}
            <div className="px-6 py-4 border-b border-slate-100 bg-white">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search SCM repositories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              {unlinkedScmRepos.length > 0 ? (
                <div className="grid gap-3">
                  {unlinkedScmRepos.map((repo, idx) => (
                    <button
                      key={idx}
                      disabled={isUpdatingProject}
                      onClick={async () => {
                        await onSelectRepo(repo, false, linkedRepos)
                        setShowAddModal(false)
                      }}
                      className="w-full flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-sm active:scale-[0.99] transition-all text-left group disabled:opacity-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200 group-hover:bg-blue-50/50 group-hover:border-blue-200 transition-colors">
                          {getProviderIcon(repo.scm_provider || repo.provider)}
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {repo.name_with_namespace}
                          </h4>
                          <span className="text-xs text-slate-500 capitalize">{repo.scm_provider} Provider</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50/50 group-hover:bg-blue-100/80 px-2.5 py-1 rounded-md transition-colors">
                          Link & Select
                        </span>
                        <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transform group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl mx-auto flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-slate-800 mb-1">No repositories found</h4>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto mb-4">
                    {searchTerm ? "Try searching for a different name, or sync more repositories in settings." : "All synced repositories are already linked to this project."}
                  </p>
                  <a
                    href="/settings"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all"
                  >
                    Go to Settings
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RepoSelector
