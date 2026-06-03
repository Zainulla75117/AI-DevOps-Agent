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
  const linkedRepos = selectedProject.linked_repositories || []

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
          onClick={onSkip}
          className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
        >
          Skip repository selection
        </button>
      </div>
    </div>
  )
}

export default RepoSelector
