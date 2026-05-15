import { useEffect, useState } from 'react'
import { getUserInfo } from '../services/authService'
import { saveCloudCredentials, saveSCMCredentials, getSCMCredentials, syncSCMRepositories, updateSCMCredentials, saveJenkinsCredentials, getJenkinsCredentials, syncJenkinsJobs } from '../services/credentialService'
import { useAuth } from '../hooks/useAuth'
import PageLayout from '../components/PageLayout'

// --- SlideOver Component ---
const SlideOver = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity cursor-pointer" 
        onClick={onClose} 
      />
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 ease-out">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white/50 backdrop-blur-md">
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h3>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
          {children}
        </div>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const { userInfo, handleLogout } = useAuth()
  const [awsCredentials, setAwsCredentials] = useState({
    name: '',
    access_key: '',
    secret_key: '',
  })
  const [scmCredentials, setScmCredentials] = useState({
    scm_name: '',
    username: '',
    pat: '',
    base_url: '',
  })
  const [jenkinsCredentials, setJenkinsCredentials] = useState({
    jenkins_url: '',
    username: '',
    token: '',
    type: 'public',
  })
  const [savedSCMTools, setSavedSCMTools] = useState([])
  const [savedSCMCredentials, setSavedSCMCredentials] = useState([])
  const [savedJenkinsCredentials, setSavedJenkinsCredentials] = useState([])
  const [isLoadingSCM, setIsLoadingSCM] = useState(false)
  const [isLoadingJenkins, setIsLoadingJenkins] = useState(false)
  const [editingJenkinsId, setEditingJenkinsId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingSCM, setIsSubmittingSCM] = useState(false)
  const [isSubmittingJenkins, setIsSubmittingJenkins] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [scmError, setScmError] = useState('')
  const [scmSuccess, setScmSuccess] = useState('')
  const [jenkinsError, setJenkinsError] = useState('')
  const [jenkinsSuccess, setJenkinsSuccess] = useState('')
  const [syncingRepos, setSyncingRepos] = useState({})
  const [syncMessages, setSyncMessages] = useState({})
  const [syncingJenkins, setSyncingJenkins] = useState({})
  const [jenkinsSyncMessages, setJenkinsSyncMessages] = useState({})
  const [editingCredentialId, setEditingCredentialId] = useState(null)
  const [expandedManualPAT, setExpandedManualPAT] = useState(false)

  // New states for redesign
  const [activeTab, setActiveTab] = useState('integrations')
  const [slideOverState, setSlideOverState] = useState({ isOpen: false, type: null, title: '' })

  useEffect(() => {
    document.title = 'infraXai - Settings'
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthStatus = params.get('scm_oauth')
    const provider = params.get('provider')
    const message = params.get('message')

    if (oauthStatus === 'success' && provider) {
      setScmSuccess(`${provider.charAt(0).toUpperCase() + provider.slice(1)} connected successfully via OAuth!`)
      window.history.replaceState({}, '', '/settings')
    } else if (oauthStatus === 'error') {
      setScmError(message ? decodeURIComponent(message) : 'OAuth connection failed')
      window.history.replaceState({}, '', '/settings')
    }
  }, [])

  useEffect(() => {
    fetchSCMCredentials()
    fetchJenkinsCredentials()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchSCMCredentials = async () => {
    setIsLoadingSCM(true)
    try {
      const credentials = await getSCMCredentials()
      const credentialsArray = Array.isArray(credentials) ? credentials : (credentials.data || [])
      setSavedSCMCredentials(credentialsArray)
      const scmNames = credentialsArray.map(cred => cred.scm_name?.toLowerCase().trim()).filter(Boolean)
      setSavedSCMTools([...new Set(scmNames)])
    } catch (err) {
      console.error('Failed to fetch SCM credentials:', err)
    } finally {
      setIsLoadingSCM(false)
    }
  }

  const fetchJenkinsCredentials = async () => {
    setIsLoadingJenkins(true)
    try {
      const credentials = await getJenkinsCredentials()
      const credentialsArray = Array.isArray(credentials) ? credentials : (credentials.data || [])
      setSavedJenkinsCredentials(credentialsArray)
    } catch (err) {
      console.error('Failed to fetch Jenkins credentials:', err)
    } finally {
      setIsLoadingJenkins(false)
    }
  }

  const handleAwsCredentialsChange = (e) => {
    const { name, value } = e.target
    setAwsCredentials(prev => ({ ...prev, [name]: value }))
    setError('')
    setSuccess('')
  }

  const handleAwsSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!awsCredentials.name || !awsCredentials.access_key || !awsCredentials.secret_key) {
      setError('Please fill in all fields')
      return
    }
    setIsSubmitting(true)
    try {
      await saveCloudCredentials({
        name: awsCredentials.name,
        accessKey: awsCredentials.access_key,
        secretKey: awsCredentials.secret_key,
      })
      setSuccess('AWS credentials saved successfully!')
      setAwsCredentials({ name: '', access_key: '', secret_key: '' })
      setTimeout(() => closeSlideOver(), 1500)
    } catch (err) {
      setError(err.message || 'Failed to save credentials')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSCMCredentialsChange = (e) => {
    const { name, value } = e.target
    setScmCredentials(prev => ({ ...prev, [name]: value }))
    setScmError('')
    setScmSuccess('')
  }

  const handleEditCredential = (credential) => {
    const scmId = credential.id || credential._id
    setEditingCredentialId(scmId)
    setScmCredentials({
      scm_name: credential.scm_name || '',
      username: credential.username || '',
      pat: '',
      base_url: credential.base_url || '',
    })
    setExpandedManualPAT(true)
    setScmError('')
    setScmSuccess('')
  }

  const handleCancelEdit = () => {
    setEditingCredentialId(null)
    setScmCredentials({ scm_name: '', username: '', pat: '', base_url: '' })
    setScmError('')
    setScmSuccess('')
  }

  const handleSCMSubmit = async (e) => {
    e.preventDefault()
    setScmError('')
    setScmSuccess('')

    if (!scmCredentials.scm_name || !scmCredentials.username || (!scmCredentials.pat && !editingCredentialId)) {
      setScmError('Please fill in all required fields')
      return
    }

    setIsSubmittingSCM(true)
    try {
      if (editingCredentialId) {
        await updateSCMCredentials(editingCredentialId, {
          scm_name: scmCredentials.scm_name,
          username: scmCredentials.username,
          pat: scmCredentials.pat,
          base_url: scmCredentials.base_url || undefined,
        })
        setScmSuccess('SCM credentials updated successfully!')
      } else {
        await saveSCMCredentials({
          scm_name: scmCredentials.scm_name,
          username: scmCredentials.username,
          pat: scmCredentials.pat,
          base_url: scmCredentials.base_url || undefined,
        })
        setScmSuccess('SCM credentials saved successfully!')
      }

      await fetchSCMCredentials()
      setScmCredentials({ scm_name: '', username: '', pat: '', base_url: '' })
      setEditingCredentialId(null)
      setTimeout(() => closeSlideOver(), 1500)
    } catch (err) {
      setScmError(err.message || (editingCredentialId ? 'Failed to update SCM credentials' : 'Failed to save SCM credentials'))
    } finally {
      setIsSubmittingSCM(false)
    }
  }

  const scmLogos = {
    github: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Octicons-mark-github.svg',
    gitlab: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Gitlab_meaningful_logo.svg',
    bitbucket: 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Bitbucket-blue-logomark-only.svg',
  }

  const getSCMLogo = (scmName) => {
    const name = scmName.toLowerCase().trim()
    if (name === 'github' || name.includes('github')) return scmLogos.github
    if (name === 'gitlab' || name.includes('gitlab')) return scmLogos.gitlab
    if (name === 'bitbucket' || name.includes('bitbucket')) return scmLogos.bitbucket
    return null
  }

  const getSCMDisplayName = (scmName) => {
    const name = scmName.toLowerCase().trim()
    if (name === 'github' || name.includes('github')) return 'GitHub'
    if (name === 'gitlab' || name.includes('gitlab')) return 'GitLab'
    if (name === 'bitbucket' || name.includes('bitbucket')) return 'Bitbucket'
    return scmName
  }

  const handleJenkinsCredentialsChange = (e) => {
    const { name, value } = e.target
    setJenkinsCredentials(prev => ({ ...prev, [name]: value }))
    setJenkinsError('')
    setJenkinsSuccess('')
  }

  const handleEditJenkinsCredential = (credential) => {
    const jenkinsId = credential.id || credential._id
    setEditingJenkinsId(jenkinsId)
    setJenkinsCredentials({
      jenkins_url: credential.jenkins_url || '',
      username: credential.username || '',
      token: '',
      type: credential.type || 'public',
    })
    setJenkinsError('')
    setJenkinsSuccess('')
  }

  const handleCancelEditJenkins = () => {
    setEditingJenkinsId(null)
    setJenkinsCredentials({ jenkins_url: '', username: '', token: '', type: 'public' })
    setJenkinsError('')
    setJenkinsSuccess('')
  }

  const handleJenkinsSubmit = async (e) => {
    e.preventDefault()
    setJenkinsError('')
    setJenkinsSuccess('')

    if (!jenkinsCredentials.jenkins_url || !jenkinsCredentials.username || (!jenkinsCredentials.token && !editingJenkinsId)) {
      setJenkinsError('Please fill in all required fields')
      return
    }

    setIsSubmittingJenkins(true)
    try {
      const user = getUserInfo()
      const userName = user?.username || user?.email || user?.name || ''

      await saveJenkinsCredentials({
        jenkins_url: jenkinsCredentials.jenkins_url,
        username: jenkinsCredentials.username,
        token: jenkinsCredentials.token,
        type: jenkinsCredentials.type || 'public',
        user_name: userName,
      })

      setJenkinsSuccess(editingJenkinsId ? 'Jenkins configuration updated successfully!' : 'Jenkins configuration saved successfully!')
      await fetchJenkinsCredentials()
      setJenkinsCredentials({ jenkins_url: '', username: '', token: '', type: 'public' })
      setEditingJenkinsId(null)
      setTimeout(() => closeSlideOver(), 1500)
    } catch (err) {
      setJenkinsError(err.message || (editingJenkinsId ? 'Failed to update Jenkins configuration' : 'Failed to save Jenkins configuration'))
    } finally {
      setIsSubmittingJenkins(false)
    }
  }

  const handleSyncRepositories = async (credential) => {
    const scmId = credential.id || credential._id
    if (!scmId) {
      setSyncMessages(prev => ({ ...prev, [scmId]: 'Error: Invalid credential ID' }))
      return
    }

    setSyncingRepos(prev => ({ ...prev, [scmId]: true }))
    setSyncMessages(prev => ({ ...prev, [scmId]: '' }))

    try {
      const result = await syncSCMRepositories(scmId)
      const message = result.message || `Successfully synced ${result.repositories_count || 0} repositories from ${getSCMDisplayName(credential.scm_name)}`
      setSyncMessages(prev => ({ ...prev, [scmId]: message }))
      setTimeout(() => {
        setSyncMessages(prev => { const updated = { ...prev }; delete updated[scmId]; return updated })
      }, 5000)
    } catch (err) {
      setSyncMessages(prev => ({ ...prev, [scmId]: err.message || 'Failed to sync repositories' }))
      setTimeout(() => {
        setSyncMessages(prev => { const updated = { ...prev }; delete updated[scmId]; return updated })
      }, 5000)
    } finally {
      setSyncingRepos(prev => ({ ...prev, [scmId]: false }))
    }
  }

  const handleSyncJenkinsJobs = async (credential) => {
    const jenkinsId = credential.id || credential._id
    if (!jenkinsId) {
      setJenkinsSyncMessages(prev => ({ ...prev, [jenkinsId]: 'Error: Invalid credential ID' }))
      return
    }

    setSyncingJenkins(prev => ({ ...prev, [jenkinsId]: true }))
    setJenkinsSyncMessages(prev => ({ ...prev, [jenkinsId]: '' }))

    try {
      const user = getUserInfo()
      const userName = user?.username || user?.email || user?.name || ''
      const result = await syncJenkinsJobs(jenkinsId, userName)
      const message = result.message || `Successfully synced ${result.jobs_count || 0} jobs, ${result.nodes_count || 0} nodes, ${result.plugins_count || 0} plugins from Jenkins`
      setJenkinsSyncMessages(prev => ({ ...prev, [jenkinsId]: message }))
      setTimeout(() => {
        setJenkinsSyncMessages(prev => { const updated = { ...prev }; delete updated[jenkinsId]; return updated })
      }, 5000)
    } catch (err) {
      setJenkinsSyncMessages(prev => ({ ...prev, [jenkinsId]: err.message || 'Failed to sync Jenkins jobs' }))
      setTimeout(() => {
        setJenkinsSyncMessages(prev => { const updated = { ...prev }; delete updated[jenkinsId]; return updated })
      }, 5000)
    } finally {
      setSyncingJenkins(prev => ({ ...prev, [jenkinsId]: false }))
    }
  }

  const openSlideOver = (type, title) => {
    setSlideOverState({ isOpen: true, type, title })
  }

  const closeSlideOver = () => {
    setSlideOverState({ isOpen: false, type: null, title: '' })
    if (editingCredentialId) handleCancelEdit()
    if (editingJenkinsId) handleCancelEditJenkins()
    setAwsCredentials({ name: '', access_key: '', secret_key: '' })
    setError('')
    setSuccess('')
    setExpandedManualPAT(false)
  }

  const onEditSCM = (credential) => {
    handleEditCredential(credential)
    openSlideOver('scm', 'Update SCM Configuration')
  }

  const onEditJenkins = (credential) => {
    handleEditJenkinsCredential(credential)
    openSlideOver('jenkins', 'Update Jenkins Configuration')
  }

  return (
    <PageLayout userInfo={userInfo} onLogout={handleLogout}>
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col bg-slate-50/30 w-full relative">
        <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col lg:flex-row gap-8 lg:gap-12">
          
          {/* Sidebar */}
          <aside className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-6">
            <div className="px-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Settings</h2>
              <p className="text-sm text-slate-500 mt-1">Manage your integrations and account preferences.</p>
            </div>
            
            <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0">
              <button 
                onClick={() => setActiveTab('integrations')}
                className={`text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'integrations' 
                    ? 'bg-white shadow-sm text-[#2196F3] border border-blue-100/50' 
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 border border-transparent'
                }`}
              >
                Integrations
              </button>
              <button 
                onClick={() => setActiveTab('account')}
                className={`text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'account' 
                    ? 'bg-white shadow-sm text-[#2196F3] border border-blue-100/50' 
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 border border-transparent'
                }`}
              >
                Account Management
              </button>
            </nav>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
             
             {activeTab === 'integrations' && (
               <div className="space-y-8 animate-in fade-in duration-300">
                 
                 {/* SCM Credentials */}
                 <section className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] border border-white/60">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                     <div>
                       <h3 className="text-lg font-bold text-slate-800">SCM Integrations</h3>
                       <p className="text-sm text-slate-500 mt-1">Connect GitHub, GitLab, or Bitbucket to manage repositories.</p>
                     </div>
                     <button 
                       onClick={() => openSlideOver('scm', 'Add SCM Integration')}
                       className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                     >
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                       Add Integration
                     </button>
                   </div>

                   {isLoadingSCM ? (
                     <div className="flex items-center gap-3 text-slate-500 p-4">
                       <span className="w-4 h-4 border-2 border-[#2196F3]/30 border-t-[#2196F3] rounded-full animate-spin"></span>
                       <span className="text-sm font-medium">Loading SCM credentials...</span>
                     </div>
                   ) : savedSCMCredentials.length > 0 ? (
                     <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                       {savedSCMCredentials.map((credential, index) => {
                         const scmName = credential.scm_name?.toLowerCase().trim() || ''
                         const logo = getSCMLogo(scmName)
                         const displayName = getSCMDisplayName(scmName)
                         const scmId = credential.id || credential._id || index
                         const isSyncing = syncingRepos[scmId] || false
                         const syncMessage = syncMessages[scmId] || ''
                         const isSuccessMessage = syncMessage && !syncMessage.includes('Error') && !syncMessage.includes('Failed')

                         return (
                           <div key={`${scmId}`} className="group relative flex flex-col p-5 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-200 hover:border-blue-200/50">
                             <div className="flex items-start justify-between mb-4">
                               <div className="flex items-center gap-3">
                                 {logo ? (
                                   <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2">
                                     <img src={logo} alt={displayName} className="w-full h-full object-contain" />
                                   </div>
                                 ) : (
                                   <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                     <span className="text-sm font-bold text-slate-500">{displayName.charAt(0)}</span>
                                   </div>
                                 )}
                                 <div>
                                   <h4 className="font-bold text-slate-800">{displayName}</h4>
                                   <div className="flex items-center gap-2 mt-0.5">
                                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                     <span className="text-xs font-medium text-slate-500">Connected</span>
                                     <span className="text-xs font-medium text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 ml-1">
                                       {credential.auth_type === 'github_app' ? 'App' : credential.auth_type === 'oauth' ? 'OAuth' : 'PAT'}
                                     </span>
                                   </div>
                                 </div>
                               </div>
                             </div>

                             <div className="space-y-2 mb-4 flex-1">
                               <div className="flex items-center justify-between text-sm">
                                 <span className="text-slate-500">Username</span>
                                 <span className="font-medium text-slate-700">{credential.username || 'N/A'}</span>
                               </div>
                               {credential.auth_type === 'oauth' && (
                                 <div className="flex items-center justify-between text-sm">
                                   <span className="text-slate-500">Scopes</span>
                                   <span className="font-mono text-xs text-slate-600 bg-slate-50 px-2 py-0.5 rounded">{credential.oauth_scopes || 'repo'}</span>
                                 </div>
                               )}
                             </div>

                             {syncMessage && (
                               <div className={`mb-4 px-3 py-2 rounded-lg text-xs font-medium ${isSuccessMessage ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                 {syncMessage}
                               </div>
                             )}

                             <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                               <button 
                                 onClick={() => onEditSCM(credential)}
                                 disabled={isSyncing}
                                 className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
                               >
                                 Configure
                               </button>
                               <button 
                                 onClick={() => handleSyncRepositories(credential)}
                                 disabled={isSyncing}
                                 className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                                   isSyncing ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                 }`}
                               >
                                 {isSyncing ? (
                                   <><span className="w-3.5 h-3.5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></span> Syncing</>
                                 ) : 'Sync Repos'}
                               </button>
                             </div>
                           </div>
                         )
                       })}
                     </div>
                   ) : (
                     <div className="px-6 py-8 bg-slate-50/50 border border-slate-200 border-dashed rounded-2xl text-center">
                       <svg className="w-8 h-8 text-slate-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                       <p className="text-sm font-medium text-slate-600">No SCM integrations configured.</p>
                       <p className="text-xs text-slate-400 mt-1">Connect your repositories to get started.</p>
                     </div>
                   )}
                 </section>

                 {/* Jenkins Configuration */}
                 <section className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] border border-white/60">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                     <div>
                       <h3 className="text-lg font-bold text-slate-800">Jenkins Configuration</h3>
                       <p className="text-sm text-slate-500 mt-1">Connect your Jenkins servers for pipeline automation.</p>
                     </div>
                     <button 
                       onClick={() => openSlideOver('jenkins', 'Add Jenkins Server')}
                       className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                     >
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                       Add Server
                     </button>
                   </div>

                   {isLoadingJenkins ? (
                     <div className="flex items-center gap-3 text-slate-500 p-4">
                       <span className="w-4 h-4 border-2 border-[#2196F3]/30 border-t-[#2196F3] rounded-full animate-spin"></span>
                       <span className="text-sm font-medium">Loading Jenkins configurations...</span>
                     </div>
                   ) : savedJenkinsCredentials.length > 0 ? (
                     <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                       {savedJenkinsCredentials.map((credential, index) => {
                         const jenkinsId = credential.id || credential._id || index
                         const isSyncing = syncingJenkins[jenkinsId] || false
                         const syncMessage = jenkinsSyncMessages[jenkinsId] || ''
                         const isSuccessMessage = syncMessage && !syncMessage.includes('Error') && !syncMessage.includes('Failed')

                         return (
                           <div key={`${jenkinsId}`} className="group relative flex flex-col p-5 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-200 hover:border-blue-200/50">
                             <div className="flex items-start justify-between mb-4">
                               <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1.5">
                                   <img src="https://upload.wikimedia.org/wikipedia/commons/e/e9/Jenkins_logo.svg" alt="Jenkins" className="w-full h-full object-contain" />
                                 </div>
                                 <div>
                                   <h4 className="font-bold text-slate-800">Jenkins Server</h4>
                                   <div className="flex items-center gap-2 mt-0.5">
                                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                     <span className="text-xs font-medium text-slate-500">Connected</span>
                                     <span className="text-xs font-medium text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 ml-1">
                                       {credential.type === 'public' ? 'Public' : 'Private'}
                                     </span>
                                   </div>
                                 </div>
                               </div>
                             </div>

                             <div className="space-y-2 mb-4 flex-1">
                               <div className="flex items-center justify-between text-sm">
                                 <span className="text-slate-500">URL</span>
                                 <span className="font-medium text-slate-700 truncate max-w-[200px]" title={credential.jenkins_url}>{credential.jenkins_url}</span>
                               </div>
                               <div className="flex items-center justify-between text-sm">
                                 <span className="text-slate-500">User</span>
                                 <span className="font-medium text-slate-700">{credential.username}</span>
                               </div>
                             </div>

                             {syncMessage && (
                               <div className={`mb-4 px-3 py-2 rounded-lg text-xs font-medium ${isSuccessMessage ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                 {syncMessage}
                               </div>
                             )}

                             <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                               <button 
                                 onClick={() => onEditJenkins(credential)}
                                 disabled={isSyncing}
                                 className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
                               >
                                 Configure
                               </button>
                               <button 
                                 onClick={() => handleSyncJenkinsJobs(credential)}
                                 disabled={isSyncing}
                                 className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                                   isSyncing ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                 }`}
                               >
                                 {isSyncing ? (
                                   <><span className="w-3.5 h-3.5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></span> Syncing</>
                                 ) : 'Sync Jobs'}
                               </button>
                             </div>
                           </div>
                         )
                       })}
                     </div>
                   ) : (
                     <div className="px-6 py-8 bg-slate-50/50 border border-slate-200 border-dashed rounded-2xl text-center">
                       <p className="text-sm font-medium text-slate-600">No Jenkins servers configured.</p>
                     </div>
                   )}
                 </section>

                 {/* Cloud Credentials */}
                 <section className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] border border-white/60">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                     <div>
                       <h3 className="text-lg font-bold text-slate-800">Cloud Credentials</h3>
                       <p className="text-sm text-slate-500 mt-1">Configure AWS, GCP, or Azure keys for infrastructure provisioning.</p>
                     </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {/* AWS Card */}
                     <button 
                       onClick={() => openSlideOver('aws', 'Configure AWS')}
                       className="group flex flex-col items-center justify-center gap-3 p-6 bg-white rounded-2xl border border-slate-200/60 hover:border-orange-300 hover:shadow-md transition-all text-center"
                     >
                       <img src="https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg" alt="AWS" className="h-10 object-contain group-hover:scale-105 transition-transform" />
                       <span className="font-semibold text-slate-700">Amazon Web Services</span>
                     </button>
                     {/* Placeholder for others */}
                     <div className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50/50 rounded-2xl border border-slate-200 border-dashed opacity-50 cursor-not-allowed">
                       <span className="font-semibold text-slate-500">Google Cloud (Coming Soon)</span>
                     </div>
                     <div className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50/50 rounded-2xl border border-slate-200 border-dashed opacity-50 cursor-not-allowed">
                       <span className="font-semibold text-slate-500">Azure (Coming Soon)</span>
                     </div>
                   </div>
                 </section>

               </div>
             )}

             {activeTab === 'account' && (
               <div className="space-y-8 animate-in fade-in duration-300">
                 <section className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] border border-white/60">
                   <div className="flex items-center gap-5 mb-8">
                     <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-600 font-bold text-2xl font-display shadow-inner">
                       {(userInfo?.name || userInfo?.username || userInfo?.email || 'U')[0].toUpperCase()}
                     </div>
                     <div>
                       <h3 className="text-xl font-bold text-slate-800">{userInfo?.name || userInfo?.username || 'User'}</h3>
                       <p className="text-slate-500">{userInfo?.email}</p>
                     </div>
                   </div>

                   <div className="border-t border-slate-100 pt-8">
                     <h4 className="text-base font-semibold text-slate-800 mb-4">Danger Zone</h4>
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-red-50/50 border border-red-100 rounded-2xl">
                       <div>
                         <h5 className="font-semibold text-red-900">Sign Out</h5>
                         <p className="text-sm text-red-700/80 mt-0.5">Securely end your current session.</p>
                       </div>
                       <button
                         onClick={handleLogout}
                         className="px-6 py-2.5 bg-white text-red-600 font-semibold text-sm rounded-xl border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all shadow-sm"
                       >
                         Sign Out
                       </button>
                     </div>
                   </div>
                 </section>
               </div>
             )}
          </div>
        </div>

        {/* --- SlideOver Contents --- */}
        <SlideOver 
          isOpen={slideOverState.isOpen && slideOverState.type === 'scm'} 
          onClose={closeSlideOver} 
          title={slideOverState.title}
        >
          <div className="space-y-6">
            {!editingCredentialId && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    const token = localStorage.getItem('jwt_token')
                    if (!token) {
                      setScmError('Please log in first to connect via OAuth')
                      return
                    }
                    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
                    window.location.href = `${apiUrl}/api/scm/oauth/github/login?token=${token}`
                  }}
                  className="group flex flex-col items-center gap-2 p-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all shadow-md relative overflow-hidden"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/></svg>
                  <span className="text-sm font-semibold">GitHub App</span>
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 rounded">Rec</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedManualPAT(true)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all border ${expandedManualPAT ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'}`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                  <span className="text-sm font-semibold">Manual PAT</span>
                </button>
              </div>
            )}

            {(expandedManualPAT || editingCredentialId) && (
              <form onSubmit={handleSCMSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">SCM Provider</label>
                  <select name="scm_name" value={scmCredentials.scm_name} onChange={handleSCMCredentialsChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-xl focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20 outline-none" required>
                    <option value="">Select Provider</option>
                    <option value="github">GitHub</option>
                    <option value="gitlab">GitLab</option>
                    <option value="bitbucket">Bitbucket</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Username</label>
                  <input type="text" name="username" value={scmCredentials.username} onChange={handleSCMCredentialsChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-xl focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20 outline-none" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Personal Access Token</label>
                  <input type="password" name="pat" value={scmCredentials.pat} onChange={handleSCMCredentialsChange} placeholder={editingCredentialId ? "Leave empty to keep current" : ""} className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-xl focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20 outline-none" required={!editingCredentialId} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Base URL <span className="text-slate-400 normal-case">(Optional)</span></label>
                  <input type="url" name="base_url" value={scmCredentials.base_url} onChange={handleSCMCredentialsChange} placeholder="For self-hosted instances" className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-xl focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20 outline-none" />
                </div>

                {scmError && <div className="p-3 text-sm bg-red-50 text-red-700 rounded-lg">{scmError}</div>}
                {scmSuccess && <div className="p-3 text-sm bg-emerald-50 text-emerald-700 rounded-lg">{scmSuccess}</div>}

                <button type="submit" disabled={isSubmittingSCM} className="w-full mt-4 px-6 py-3 bg-[#2196F3] hover:bg-blue-600 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all flex justify-center items-center gap-2">
                  {isSubmittingSCM ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : null}
                  {editingCredentialId ? 'Update Settings' : 'Save Connection'}
                </button>
              </form>
            )}
          </div>
        </SlideOver>

        <SlideOver 
          isOpen={slideOverState.isOpen && slideOverState.type === 'jenkins'} 
          onClose={closeSlideOver} 
          title={slideOverState.title}
        >
          <form onSubmit={handleJenkinsSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Jenkins URL</label>
              <input type="url" name="jenkins_url" value={jenkinsCredentials.jenkins_url} onChange={handleJenkinsCredentialsChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-xl focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20 outline-none" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Username</label>
              <input type="text" name="username" value={jenkinsCredentials.username} onChange={handleJenkinsCredentialsChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-xl focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20 outline-none" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">API Token</label>
              <input type="password" name="token" value={jenkinsCredentials.token} onChange={handleJenkinsCredentialsChange} placeholder={editingJenkinsId ? "Leave empty to keep current" : ""} className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-xl focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20 outline-none" required={!editingJenkinsId} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</label>
              <select name="type" value={jenkinsCredentials.type} onChange={handleJenkinsCredentialsChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-xl focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20 outline-none" required>
                <option value="public">Publicly Accessible</option>
                <option value="private">Private / Internal</option>
              </select>
            </div>

            {jenkinsError && <div className="p-3 text-sm bg-red-50 text-red-700 rounded-lg">{jenkinsError}</div>}
            {jenkinsSuccess && <div className="p-3 text-sm bg-emerald-50 text-emerald-700 rounded-lg">{jenkinsSuccess}</div>}

            <button type="submit" disabled={isSubmittingJenkins} className="w-full mt-4 px-6 py-3 bg-[#2196F3] hover:bg-blue-600 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all flex justify-center items-center gap-2">
              {isSubmittingJenkins ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : null}
              {editingJenkinsId ? 'Update Server' : 'Add Server'}
            </button>
          </form>
        </SlideOver>

        <SlideOver 
          isOpen={slideOverState.isOpen && slideOverState.type === 'aws'} 
          onClose={closeSlideOver} 
          title={slideOverState.title}
        >
          <form onSubmit={handleAwsSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Credential Name</label>
              <input type="text" name="name" value={awsCredentials.name} onChange={handleAwsCredentialsChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-xl focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20 outline-none" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Access Key ID</label>
              <input type="text" name="access_key" value={awsCredentials.access_key} onChange={handleAwsCredentialsChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-xl focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20 outline-none" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Secret Access Key</label>
              <input type="password" name="secret_key" value={awsCredentials.secret_key} onChange={handleAwsCredentialsChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-xl focus:border-[#2196F3] focus:ring-2 focus:ring-[#2196F3]/20 outline-none" required />
            </div>

            {error && <div className="p-3 text-sm bg-red-50 text-red-700 rounded-lg">{error}</div>}
            {success && <div className="p-3 text-sm bg-emerald-50 text-emerald-700 rounded-lg">{success}</div>}

            <button type="submit" disabled={isSubmitting} className="w-full mt-4 px-6 py-3 bg-[#2196F3] hover:bg-blue-600 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all flex justify-center items-center gap-2">
              {isSubmitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : null}
              Save AWS Credentials
            </button>
          </form>
        </SlideOver>

      </main>
    </PageLayout>
  )
}

export default SettingsPage
