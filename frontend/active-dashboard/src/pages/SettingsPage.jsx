import { useEffect, useState } from 'react'
import { getUserInfo } from '../services/authService'
import { saveCloudCredentials, saveSCMCredentials, getSCMCredentials, syncSCMRepositories, updateSCMCredentials, saveJenkinsCredentials, getJenkinsCredentials, syncJenkinsJobs } from '../services/credentialService'
import { useAuth } from '../hooks/useAuth'
import PageLayout from '../components/PageLayout'

const SettingsPage = () => {
  const { userInfo, handleLogout } = useAuth()
  const [expandedProvider, setExpandedProvider] = useState(null) // 'aws', 'gcp', 'azure', etc.
  const [expandedSCM, setExpandedSCM] = useState(false)
  const [expandedJenkins, setExpandedJenkins] = useState(false)
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
    type: 'public', // 'public' or 'private'
  })
  const [savedSCMTools, setSavedSCMTools] = useState([]) // Array to store saved SCM tools
  const [savedSCMCredentials, setSavedSCMCredentials] = useState([]) // Array to store full SCM credential objects
  const [savedJenkinsCredentials, setSavedJenkinsCredentials] = useState([]) // Array to store full Jenkins credential objects
  const [isLoadingSCM, setIsLoadingSCM] = useState(false)
  const [isLoadingJenkins, setIsLoadingJenkins] = useState(false)
  const [editingJenkinsId, setEditingJenkinsId] = useState(null) // Track which Jenkins credential is being edited
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmittingSCM, setIsSubmittingSCM] = useState(false)
  const [isSubmittingJenkins, setIsSubmittingJenkins] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [scmError, setScmError] = useState('')
  const [scmSuccess, setScmSuccess] = useState('')
  const [jenkinsError, setJenkinsError] = useState('')
  const [jenkinsSuccess, setJenkinsSuccess] = useState('')
  const [syncingRepos, setSyncingRepos] = useState({}) // Track syncing state per credential: { scmId: boolean }
  const [syncMessages, setSyncMessages] = useState({}) // Track sync messages per credential: { scmId: string }
  const [syncingJenkins, setSyncingJenkins] = useState({}) // Track syncing state per Jenkins credential: { jenkinsId: boolean }
  const [jenkinsSyncMessages, setJenkinsSyncMessages] = useState({}) // Track sync messages per Jenkins credential: { jenkinsId: string }
  const [editingCredentialId, setEditingCredentialId] = useState(null) // Track which credential is being edited

  useEffect(() => {
    document.title = 'DevOps Infinity - Settings'
  }, [])

  useEffect(() => {
    // Fetch saved SCM credentials
    fetchSCMCredentials()
    // Fetch saved Jenkins credentials
    fetchJenkinsCredentials()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchSCMCredentials = async () => {
    setIsLoadingSCM(true)
    try {
      const credentials = await getSCMCredentials()
      // Handle both array and object responses
      const credentialsArray = Array.isArray(credentials) ? credentials : (credentials.data || [])
      setSavedSCMCredentials(credentialsArray)
      
      // Extract unique SCM names for logo display
      const scmNames = credentialsArray.map(cred => cred.scm_name?.toLowerCase().trim()).filter(Boolean)
      setSavedSCMTools([...new Set(scmNames)])
    } catch (err) {
      console.error('Failed to fetch SCM credentials:', err)
      // Don't show error to user on initial load, just log it
    } finally {
      setIsLoadingSCM(false)
    }
  }

  const fetchJenkinsCredentials = async () => {
    setIsLoadingJenkins(true)
    try {
      const credentials = await getJenkinsCredentials()
      // Handle both array and object responses
      const credentialsArray = Array.isArray(credentials) ? credentials : (credentials.data || [])
      setSavedJenkinsCredentials(credentialsArray)
    } catch (err) {
      console.error('Failed to fetch Jenkins credentials:', err)
      // Don't show error to user on initial load, just log it
    } finally {
      setIsLoadingJenkins(false)
    }
  }

  const handleAwsCredentialsChange = (e) => {
    const { name, value } = e.target
    setAwsCredentials((prev) => ({
      ...prev,
      [name]: value,
    }))
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
      setAwsCredentials({
        name: '',
        access_key: '',
        secret_key: '',
      })
    } catch (err) {
      setError(err.message || 'Failed to save credentials')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSCMCredentialsChange = (e) => {
    const { name, value } = e.target
    setScmCredentials((prev) => ({
      ...prev,
      [name]: value,
    }))
    setScmError('')
    setScmSuccess('')
  }

  const handleEditCredential = (credential) => {
    const scmId = credential.id || credential._id
    setEditingCredentialId(scmId)
    setScmCredentials({
      scm_name: credential.scm_name || '',
      username: credential.username || '',
      pat: '', // Don't pre-fill PAT for security
      base_url: credential.base_url || '',
    })
    setExpandedSCM(true) // Expand the form
    setScmError('')
    setScmSuccess('')
  }

  const handleCancelEdit = () => {
    setEditingCredentialId(null)
    setScmCredentials({
      scm_name: '',
      username: '',
      pat: '',
      base_url: '',
    })
    setScmError('')
    setScmSuccess('')
  }

  const handleSCMSubmit = async (e) => {
    e.preventDefault()
    setScmError('')
    setScmSuccess('')

    // Validation: PAT is required for new credentials, optional for updates
    if (!scmCredentials.scm_name || !scmCredentials.username || (!scmCredentials.pat && !editingCredentialId)) {
      setScmError('Please fill in all required fields')
      return
    }

    setIsSubmittingSCM(true)

    try {
      if (editingCredentialId) {
        // Update existing credential
        await updateSCMCredentials(editingCredentialId, {
          scm_name: scmCredentials.scm_name,
          username: scmCredentials.username,
          pat: scmCredentials.pat,
          base_url: scmCredentials.base_url || undefined, // Only include if provided
        })
        setScmSuccess('SCM credentials updated successfully!')
      } else {
        // Create new credential
      await saveSCMCredentials({
        scm_name: scmCredentials.scm_name,
        username: scmCredentials.username,
        pat: scmCredentials.pat,
          base_url: scmCredentials.base_url || undefined, // Only include if provided
      })
        setScmSuccess('SCM credentials saved successfully!')
      }

      // Refresh the SCM credentials list
      await fetchSCMCredentials()
      setScmCredentials({
        scm_name: '',
        username: '',
        pat: '',
        base_url: '',
      })
      setEditingCredentialId(null)
    } catch (err) {
      setScmError(err.message || (editingCredentialId ? 'Failed to update SCM credentials' : 'Failed to save SCM credentials'))
    } finally {
      setIsSubmittingSCM(false)
    }
  }

  // SCM tool logos mapping - using Wikipedia Commons
  const scmLogos = {
    github: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Octicons-mark-github.svg',
    gitlab: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Gitlab_meaningful_logo.svg',
    bitbucket: 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Bitbucket-blue-logomark-only.svg',
  }

  const getSCMLogo = (scmName) => {
    const name = scmName.toLowerCase().trim()
    // Direct match for saved values
    if (name === 'github') return scmLogos.github
    if (name === 'gitlab') return scmLogos.gitlab
    if (name === 'bitbucket') return scmLogos.bitbucket
    // Fallback for partial matches
    if (name.includes('github')) return scmLogos.github
    if (name.includes('gitlab')) return scmLogos.gitlab
    if (name.includes('bitbucket')) return scmLogos.bitbucket
    return null
  }

  const getSCMDisplayName = (scmName) => {
    const name = scmName.toLowerCase().trim()
    // Direct match for saved values
    if (name === 'github') return 'GitHub'
    if (name === 'gitlab') return 'GitLab'
    if (name === 'bitbucket') return 'Bitbucket'
    // Fallback for partial matches
    if (name.includes('github')) return 'GitHub'
    if (name.includes('gitlab')) return 'GitLab'
    if (name.includes('bitbucket')) return 'Bitbucket'
    return scmName
  }

  const handleJenkinsCredentialsChange = (e) => {
    const { name, value } = e.target
    setJenkinsCredentials((prev) => ({
      ...prev,
      [name]: value,
    }))
    setJenkinsError('')
    setJenkinsSuccess('')
  }

  const handleEditJenkinsCredential = (credential) => {
    const jenkinsId = credential.id || credential._id
    setEditingJenkinsId(jenkinsId)
    setJenkinsCredentials({
      jenkins_url: credential.jenkins_url || '',
      username: credential.username || '',
      token: '', // Don't pre-fill token for security
      type: credential.type || 'public',
    })
    setExpandedJenkins(true) // Expand the form
    setJenkinsError('')
    setJenkinsSuccess('')
  }

  const handleCancelEditJenkins = () => {
    setEditingJenkinsId(null)
    setJenkinsCredentials({
      jenkins_url: '',
      username: '',
      token: '',
      type: 'public',
    })
    setJenkinsError('')
    setJenkinsSuccess('')
  }

  const handleJenkinsSubmit = async (e) => {
    e.preventDefault()
    setJenkinsError('')
    setJenkinsSuccess('')

    // Validation: Token is required for new credentials, optional for updates
    if (!jenkinsCredentials.jenkins_url || !jenkinsCredentials.username || (!jenkinsCredentials.token && !editingJenkinsId)) {
      setJenkinsError('Please fill in all required fields')
      return
    }

    setIsSubmittingJenkins(true)

    try {
      // Get user info to include user name in payload
      const user = getUserInfo()
      // user_info in localStorage has: { username, email }
      const userName = user?.username || user?.email || user?.name || ''
      
      await saveJenkinsCredentials({
        jenkins_url: jenkinsCredentials.jenkins_url,
        username: jenkinsCredentials.username,
        token: jenkinsCredentials.token,
        type: jenkinsCredentials.type || 'public',
        user_name: userName, // Include user's name
      })
      
      setJenkinsSuccess(editingJenkinsId ? 'Jenkins configuration updated successfully!' : 'Jenkins configuration saved successfully!')
      
      // Refresh the Jenkins credentials list
      await fetchJenkinsCredentials()
      
      setJenkinsCredentials({
        jenkins_url: '',
        username: '',
        token: '',
        type: 'public',
      })
      setEditingJenkinsId(null)
    } catch (err) {
      setJenkinsError(err.message || (editingJenkinsId ? 'Failed to update Jenkins configuration' : 'Failed to save Jenkins configuration'))
    } finally {
      setIsSubmittingJenkins(false)
    }
  }

  const handleSyncRepositories = async (credential) => {
    const scmId = credential.id || credential._id
    if (!scmId) {
      setSyncMessages((prev) => ({
        ...prev,
        [scmId]: 'Error: Invalid credential ID'
      }))
      return
    }

    // Set syncing state
    setSyncingRepos((prev) => ({ ...prev, [scmId]: true }))
    setSyncMessages((prev) => ({
      ...prev,
      [scmId]: ''
    }))

    try {
      const result = await syncSCMRepositories(scmId)
      const message = result.message || `Successfully synced ${result.repositories_count || 0} repositories from ${getSCMDisplayName(credential.scm_name)}`
      setSyncMessages((prev) => ({
        ...prev,
        [scmId]: message
      }))
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSyncMessages((prev) => {
          const updated = { ...prev }
          delete updated[scmId]
          return updated
        })
      }, 5000)
    } catch (err) {
      setSyncMessages((prev) => ({
        ...prev,
        [scmId]: err.message || 'Failed to sync repositories'
      }))
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setSyncMessages((prev) => {
          const updated = { ...prev }
          delete updated[scmId]
          return updated
        })
      }, 5000)
    } finally {
      setSyncingRepos((prev) => ({ ...prev, [scmId]: false }))
    }
  }

  const handleSyncJenkinsJobs = async (credential) => {
    const jenkinsId = credential.id || credential._id
    if (!jenkinsId) {
      setJenkinsSyncMessages((prev) => ({
        ...prev,
        [jenkinsId]: 'Error: Invalid credential ID'
      }))
      return
    }

    // Set syncing state
    setSyncingJenkins((prev) => ({ ...prev, [jenkinsId]: true }))
    setJenkinsSyncMessages((prev) => ({
      ...prev,
      [jenkinsId]: ''
    }))

    try {
      // Get user info to include user name in payload
      const user = getUserInfo()
      // user_info in localStorage has: { username, email }
      const userName = user?.username || user?.email || user?.name || ''
      
      if (!userName) {
        console.warn('No username found in user info:', user)
      }
      
      const result = await syncJenkinsJobs(jenkinsId, userName)
      // Use the message from backend which includes jobs, nodes, and plugins counts
      const message = result.message || `Successfully synced ${result.jobs_count || 0} jobs, ${result.nodes_count || 0} nodes, ${result.plugins_count || 0} plugins from Jenkins`
      setJenkinsSyncMessages((prev) => ({
        ...prev,
        [jenkinsId]: message
      }))
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setJenkinsSyncMessages((prev) => {
          const updated = { ...prev }
          delete updated[jenkinsId]
          return updated
        })
      }, 5000)
    } catch (err) {
      setJenkinsSyncMessages((prev) => ({
        ...prev,
        [jenkinsId]: err.message || 'Failed to sync Jenkins jobs'
      }))
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setJenkinsSyncMessages((prev) => {
          const updated = { ...prev }
          delete updated[jenkinsId]
          return updated
        })
      }, 5000)
    } finally {
      setSyncingJenkins((prev) => ({ ...prev, [jenkinsId]: false }))
    }
  }

  return (
    <PageLayout userInfo={userInfo} onLogout={handleLogout}>
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col">
          <div className="max-w-6xl mx-auto flex-1 flex flex-col">
            <div className="bg-white/90 rounded-xl p-3 sm:p-6 shadow-lg border border-blue-200/50 mt-auto">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-3 sm:mb-4">Settings</h2>

              <div className="space-y-4 sm:space-y-5">
                {/* Credentials & Integrations */}
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-slate-800 mb-3 sm:mb-4">
                    Credentials & Integrations
                  </h3>

                  <div className="space-y-3 sm:space-y-4">
                    {/* SCM Credentials */}
                    <div className="border border-blue-200/50 rounded-xl p-3 sm:p-4">
                      <h4 className="text-sm sm:text-base font-semibold text-slate-800 mb-2 sm:mb-3">SCM Credentials</h4>
                      <p className="text-xs text-slate-600 mb-2 sm:mb-3">
                        Configure your Source Control Management (SCM) credentials for version control
                        integration. This allows the platform to access your repositories and manage
                        infrastructure as code.
                      </p>

                      {/* Saved SCM Credentials Display */}
                      {isLoadingSCM ? (
                        <div className="mb-4 flex items-center gap-2 text-slate-600">
                          <span className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></span>
                          <span className="text-sm">Loading SCM credentials...</span>
                        </div>
                      ) : savedSCMCredentials.length > 0 ? (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-slate-700 mb-3">Saved SCM Credentials:</p>
                          <div className="space-y-3">
                            {savedSCMCredentials.map((credential, index) => {
                              const scmName = credential.scm_name?.toLowerCase().trim() || ''
                              const logo = getSCMLogo(scmName)
                              const displayName = getSCMDisplayName(scmName)
                              const scmId = credential.id || credential._id || index
                              const isSyncing = syncingRepos[scmId] || false
                              const syncMessage = syncMessages[scmId] || ''
                              const isSuccessMessage = syncMessage && !syncMessage.includes('Error') && !syncMessage.includes('Failed')
                              
                              return (
                                <div
                                  key={`${scmId}`}
                                  className="px-4 py-3 bg-white/90 rounded-lg border border-blue-200/50 shadow-sm hover:shadow-md transition-shadow duration-150"
                                >
                                  {/* Credential Details */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                      {/* Logo beside SCM name */}
                                      {logo ? (
                                        <img
                                          src={logo}
                                          alt={displayName}
                                          className="w-8 h-8 object-contain flex-shrink-0"
                                          onError={(e) => {
                                            console.error(`Failed to load logo for ${scmName}:`, logo)
                                            e.target.style.display = 'none'
                                          }}
                                          onLoad={() => {
                                            console.log(`Successfully loaded logo for ${scmName}`)
                                          }}
                                          style={{ minWidth: '32px', minHeight: '32px' }}
                                        />
                                      ) : (
                                        <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                                          <span className="text-xs text-gray-500">?</span>
                                        </div>
                                      )}
                                      <h5 className="text-base font-semibold text-slate-800">{displayName}</h5>
                                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                        Connected
                                      </span>
                                    </div>
                                      
                                      <div className="flex items-center gap-2">
                                        {/* Update Button */}
                                        <button
                                          onClick={() => handleEditCredential(credential)}
                                          disabled={isSyncing || editingCredentialId === scmId}
                                          className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-150 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 hover:border-orange-300"
                                          title={`Update ${displayName} credentials`}
                                        >
                                          <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                            />
                                          </svg>
                                          <span className="hidden sm:inline">Update</span>
                                        </button>
                                        
                                        {/* Sync/Reload Button */}
                                        <button
                                          onClick={() => handleSyncRepositories(credential)}
                                          disabled={isSyncing}
                                          className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-150 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300"
                                          title={`Sync repositories from ${displayName}`}
                                        >
                                          {isSyncing ? (
                                            <>
                                              <span className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></span>
                                              <span className="hidden sm:inline">Syncing...</span>
                                            </>
                                          ) : (
                                            <>
                                              <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                                />
                                              </svg>
                                              <span className="hidden sm:inline">Sync Repos</span>
                                              <span className="sm:hidden">Sync</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                    
                                    {/* Sync Status Message */}
                                    {syncMessage && (
                                      <div className={`mt-2 px-3 py-2 rounded-lg text-xs ${
                                        isSuccessMessage 
                                          ? 'bg-green-50 border border-green-200 text-green-700' 
                                          : 'bg-red-50 border border-red-200 text-red-700'
                                      }`}>
                                        {syncMessage}
                                      </div>
                                    )}
                                    
                                    <div className="space-y-1 mt-2">
                                      <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <span className="font-medium min-w-[80px]">Username:</span>
                                        <span className="text-slate-800">{credential.username || 'N/A'}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <span className="font-medium min-w-[80px]">PAT:</span>
                                        <span className="text-slate-800">
                                          {credential.pat ? (
                                            credential.pat.length > 8 ? (
                                              <span className="font-mono">
                                                {credential.pat.substring(0, 4)}••••••••{credential.pat.substring(credential.pat.length - 4)}
                                              </span>
                                            ) : (
                                              <span className="font-mono">••••••••</span>
                                            )
                                          ) : (
                                            <span className="text-slate-400 italic">Not set</span>
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="mb-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <p className="text-sm text-slate-600">No SCM credentials saved yet.</p>
                        </div>
                      )}

                      {/* SCM Credentials Form */}
                      <div className="bg-white/80 rounded-lg border border-blue-200/30 overflow-hidden transition-colors duration-150">
                        {/* Clickable Header */}
                        <button
                          onClick={() => {
                            if (editingCredentialId) {
                              handleCancelEdit()
                            }
                            setExpandedSCM(!expandedSCM)
                          }}
                          className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-white/90 transition-colors duration-150"
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#2196F3] to-[#8b5cf6] rounded-lg flex items-center justify-center flex-shrink-0">
                              <svg
                                className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                                />
                              </svg>
                            </div>
                            <div className="text-left min-w-0">
                              <h5 className="text-base sm:text-lg font-semibold text-slate-800 mb-1">
                                {editingCredentialId ? 'Update SCM Credentials' : 'Add SCM Credentials'}
                              </h5>
                              <p className="text-xs sm:text-sm text-slate-600">
                                {editingCredentialId 
                                  ? 'Update your Source Control Management credentials'
                                  : 'Configure your Source Control Management credentials (GitHub, GitLab, Bitbucket)'}
                              </p>
                            </div>
                          </div>
                          <svg
                            className={`w-6 h-6 text-slate-600 transition-transform duration-150 ${
                              expandedSCM ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>

                        {/* Expandable Form */}
                        {expandedSCM && (
                          <div className="px-4 pb-4 border-t border-blue-200/30 pt-4 transition-colors duration-150 ease-in-out">
                            {editingCredentialId && (
                              <div className="mb-4 flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                <p className="text-sm text-orange-700">
                                  <span className="font-medium">Editing mode:</span> Updating existing credentials. Leave PAT empty to keep current value.
                                </p>
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  className="text-orange-700 hover:text-orange-900 transition-colors"
                                  title="Cancel editing"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            )}
                            <form onSubmit={handleSCMSubmit} className="space-y-4">
                              {/* SCM Name */}
                              <div className="flex flex-col gap-2">
                                <label
                                  htmlFor="scmName"
                                  className="text-sm font-semibold text-slate-700 uppercase tracking-wider"
                                >
                                  SCM Name <span className="text-red-500">*</span>
                                </label>
                                <select
                                  id="scmName"
                                  name="scm_name"
                                  value={scmCredentials.scm_name}
                                  onChange={handleSCMCredentialsChange}
                                  className="w-full px-4 py-3 bg-white border border-[#2196F3]/20 text-slate-800 text-base transition-colors duration-150 outline-none shadow-sm focus:border-[#2196F3] focus:shadow-[0_0_0_2px_rgba(33,150,243,0.08)]"
                                  style={{ borderRadius: '6px 12px 6px 12px' }}
                                  required
                                >
                                  <option value="">Select SCM Tool</option>
                                  <option value="github">GitHub</option>
                                  <option value="gitlab">GitLab</option>
                                  <option value="bitbucket">Bitbucket</option>
                                </select>
                              </div>

                              {/* Username */}
                              <div className="flex flex-col gap-2">
                                <label
                                  htmlFor="scmUsername"
                                  className="text-sm font-semibold text-slate-700 uppercase tracking-wider"
                                >
                                  Username <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  id="scmUsername"
                                  name="username"
                                  value={scmCredentials.username}
                                  onChange={handleSCMCredentialsChange}
                                  className="w-full px-3 py-2 bg-white border border-[#2196F3]/20 text-slate-800 text-sm transition-colors duration-150 outline-none shadow-sm placeholder:text-slate-400 focus:border-[#2196F3] focus:shadow-[0_0_0_2px_rgba(33,150,243,0.08)]"
                                  style={{ borderRadius: '6px 12px 6px 12px' }}
                                  placeholder="Enter SCM username"
                                  required
                                />
                              </div>

                              {/* PAT (Personal Access Token) */}
                              <div className="flex flex-col gap-2">
                                <label
                                  htmlFor="scmPAT"
                                  className="text-sm font-semibold text-slate-700 uppercase tracking-wider"
                                >
                                  Personal Access Token (PAT) {!editingCredentialId && <span className="text-red-500">*</span>}
                                  {editingCredentialId && <span className="text-slate-400 text-xs">(Leave empty to keep current)</span>}
                                </label>
                                <input
                                  type="password"
                                  id="scmPAT"
                                  name="pat"
                                  value={scmCredentials.pat}
                                  onChange={handleSCMCredentialsChange}
                                  className="w-full px-3 py-2 bg-white border border-[#2196F3]/20 text-slate-800 text-sm transition-colors duration-150 outline-none shadow-sm placeholder:text-slate-400 focus:border-[#2196F3] focus:shadow-[0_0_0_2px_rgba(33,150,243,0.08)]"
                                  style={{ borderRadius: '6px 12px 6px 12px' }}
                                  placeholder={editingCredentialId ? "Enter new PAT (leave empty to keep current)" : "Enter Personal Access Token"}
                                  required={!editingCredentialId}
                                />
                              </div>

                              {/* Base URL (Optional) */}
                              <div className="flex flex-col gap-2">
                                <label
                                  htmlFor="scmBaseUrl"
                                  className="text-sm font-semibold text-slate-700 uppercase tracking-wider"
                                >
                                  Base URL <span className="text-slate-400 text-xs">(Optional)</span>
                                </label>
                                <input
                                  type="url"
                                  id="scmBaseUrl"
                                  name="base_url"
                                  value={scmCredentials.base_url}
                                  onChange={handleSCMCredentialsChange}
                                  className="w-full px-3 py-2 bg-white border border-[#2196F3]/20 text-slate-800 text-sm transition-colors duration-150 outline-none shadow-sm placeholder:text-slate-400 focus:border-[#2196F3] focus:shadow-[0_0_0_2px_rgba(33,150,243,0.08)]"
                                  style={{ borderRadius: '6px 12px 6px 12px' }}
                                  placeholder="https://gitlab.example.com (for self-hosted instances)"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                  Leave empty for default (gitlab.com, github.com, bitbucket.org). Required for self-hosted instances.
                                </p>
                              </div>

                              {scmError && (
                                <div
                                  className="flex items-center gap-2 px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg"
                                  role="alert"
                                >
                                  <span>⚠️</span>
                                  <span>{scmError}</span>
                                </div>
                              )}

                              {scmSuccess && (
                                <div
                                  className="flex items-center gap-2 px-4 py-3 text-sm bg-green-50 border border-green-200 text-green-700 rounded-lg"
                                  role="alert"
                                >
                                  <span>✅</span>
                                  <span>{scmSuccess}</span>
                                </div>
                              )}

                              <div className="flex items-center gap-3">
                                {editingCredentialId && (
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    disabled={isSubmittingSCM}
                                    className="px-6 py-3 bg-white border border-slate-300 text-slate-700 text-base font-medium rounded-lg hover:bg-slate-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Cancel
                                  </button>
                                )}
                              <button
                                type="submit"
                                disabled={isSubmittingSCM}
                                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[#42A5F5] to-[#66BB6A] text-white text-base font-semibold cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden group hover:from-[#1E88E5] hover:to-[#4CAF50] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                                style={{ borderRadius: '12px 4px 12px 4px' }}
                              >
                                {isSubmittingSCM ? (
                                  <>
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                                      {editingCredentialId ? 'Updating...' : 'Saving...'}
                                  </>
                                ) : (
                                  <>
                                      <span>{editingCredentialId ? 'Update SCM Credentials' : 'Save SCM Credentials'}</span>
                                    <span className="text-xl transition-transform duration-300 group-hover:translate-x-1">
                                      →
                                    </span>
                                  </>
                                )}
                              </button>
                              </div>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cloud Credentials */}
                    <div className="border border-blue-200/50 rounded-xl p-3 sm:p-4">
                      <h4 className="text-sm sm:text-base font-semibold text-slate-800 mb-2 sm:mb-3">Cloud Credentials</h4>

                      {/* AWS Credentials Card */}
                      <div className="bg-white/80 rounded-lg border border-orange-200/30 overflow-hidden transition-colors duration-150">
                        {/* Clickable Header */}
                        <button
                          onClick={() => setExpandedProvider(expandedProvider === 'aws' ? null : 'aws')}
                          className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-white/90 transition-colors duration-150"
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <img
                              src="https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg"
                              alt="AWS"
                              className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0"
                            />
                            <div className="text-left min-w-0">
                              <h5 className="text-base sm:text-lg font-semibold text-slate-800 mb-1">AWS</h5>
                              <p className="text-xs sm:text-sm text-slate-600">
                                Configure your Amazon Web Services credentials to manage infrastructure
                              </p>
                            </div>
                          </div>
                          <svg
                            className={`w-6 h-6 text-slate-600 transition-transform duration-150 ${
                              expandedProvider === 'aws' ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>

                        {/* Expandable Form */}
                        {expandedProvider === 'aws' && (
                          <div className="px-6 pb-6 border-t border-orange-200/30 pt-6 transition-colors duration-150 ease-in-out">
                            <form onSubmit={handleAwsSubmit} className="space-y-4">
                              {/* Credential Name */}
                              <div className="flex flex-col gap-2">
                                <label
                                  htmlFor="awsName"
                                  className="text-sm font-semibold text-slate-700 uppercase tracking-wider"
                                >
                                  Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  id="awsName"
                                  name="name"
                                  value={awsCredentials.name}
                                  onChange={handleAwsCredentialsChange}
                                  className="w-full px-3 py-2 bg-white border border-[#2196F3]/20 text-slate-800 text-sm transition-colors duration-150 outline-none shadow-sm placeholder:text-slate-400 focus:border-[#2196F3] focus:shadow-[0_0_0_2px_rgba(33,150,243,0.08)]"
                                  style={{ borderRadius: '6px 12px 6px 12px' }}
                                  placeholder="Enter credential name"
                                  required
                                />
                              </div>

                              {/* Access Key */}
                              <div className="flex flex-col gap-2">
                                <label
                                  htmlFor="awsAccessKey"
                                  className="text-sm font-semibold text-slate-700 uppercase tracking-wider"
                                >
                                  Access Key <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  id="awsAccessKey"
                                  name="access_key"
                                  value={awsCredentials.access_key}
                                  onChange={handleAwsCredentialsChange}
                                  className="w-full px-3 py-2 bg-white border border-[#2196F3]/20 text-slate-800 text-sm transition-colors duration-150 outline-none shadow-sm placeholder:text-slate-400 focus:border-[#2196F3] focus:shadow-[0_0_0_2px_rgba(33,150,243,0.08)]"
                                  style={{ borderRadius: '6px 12px 6px 12px' }}
                                  placeholder="Enter AWS Access Key"
                                  required
                                />
                              </div>

                              {/* Secret Key */}
                              <div className="flex flex-col gap-2">
                                <label
                                  htmlFor="awsSecretKey"
                                  className="text-sm font-semibold text-slate-700 uppercase tracking-wider"
                                >
                                  Secret Key <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="password"
                                  id="awsSecretKey"
                                  name="secret_key"
                                  value={awsCredentials.secret_key}
                                  onChange={handleAwsCredentialsChange}
                                  className="w-full px-3 py-2 bg-white border border-[#2196F3]/20 text-slate-800 text-sm transition-colors duration-150 outline-none shadow-sm placeholder:text-slate-400 focus:border-[#2196F3] focus:shadow-[0_0_0_2px_rgba(33,150,243,0.08)]"
                                  style={{ borderRadius: '6px 12px 6px 12px' }}
                                  placeholder="Enter AWS Secret Key"
                                  required
                                />
                              </div>

                              {error && (
                                <div
                                  className="flex items-center gap-2 px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg"
                                  role="alert"
                                >
                                  <span>⚠️</span>
                                  <span>{error}</span>
                                </div>
                              )}

                              {success && (
                                <div
                                  className="flex items-center gap-2 px-4 py-3 text-sm bg-green-50 border border-green-200 text-green-700 rounded-lg"
                                  role="alert"
                                >
                                  <span>✅</span>
                                  <span>{success}</span>
                                </div>
                              )}

                              <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2.5 bg-gradient-to-r from-[#42A5F5] to-[#66BB6A] text-white text-sm font-semibold cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden group hover:from-[#1E88E5] hover:to-[#4CAF50] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                                style={{ borderRadius: '12px 4px 12px 4px' }}
                              >
                                {isSubmitting ? (
                                  <>
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <span>Save AWS Credentials</span>
                                    <span className="text-xl transition-transform duration-300 group-hover:translate-x-1">
                                      →
                                    </span>
                                  </>
                                )}
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Jenkins Configuration */}
                    <div className="border border-blue-200/50 rounded-xl p-3 sm:p-4">
                      <h4 className="text-sm sm:text-base font-semibold text-slate-800 mb-2 sm:mb-3">Jenkins Configuration</h4>
                      <p className="text-xs text-slate-600 mb-2 sm:mb-3">
                        Configure your Jenkins server connection details to enable CI/CD pipeline automation
                        and build management.
                      </p>

                      {/* Saved Jenkins Credentials Display */}
                      {isLoadingJenkins ? (
                        <div className="mb-4 flex items-center gap-2 text-slate-600">
                          <span className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></span>
                          <span className="text-sm">Loading Jenkins credentials...</span>
                        </div>
                      ) : savedJenkinsCredentials.length > 0 ? (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-slate-700 mb-3">Saved Jenkins Configurations:</p>
                          <div className="space-y-3">
                            {savedJenkinsCredentials.map((credential, index) => {
                              const jenkinsId = credential.id || credential._id || index
                              const isSyncing = syncingJenkins[jenkinsId] || false
                              const syncMessage = jenkinsSyncMessages[jenkinsId] || ''
                              const isSuccessMessage = syncMessage && !syncMessage.includes('Error') && !syncMessage.includes('Failed')
                              
                              return (
                                <div
                                  key={`${jenkinsId}`}
                                  className="px-4 py-3 bg-white/90 rounded-lg border border-blue-200/50 shadow-sm hover:shadow-md transition-shadow duration-150"
                                >
                                  {/* Credential Details */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                        {/* Jenkins Logo */}
                                        <img
                                          src="https://upload.wikimedia.org/wikipedia/commons/e/e9/Jenkins_logo.svg"
                                          alt="Jenkins"
                                          className="w-8 h-8 object-contain flex-shrink-0"
                                          onError={(e) => {
                                            e.target.style.display = 'none'
                                          }}
                                        />
                                        <h5 className="text-base font-semibold text-slate-800">Jenkins</h5>
                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                          Connected
                                        </span>
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                          credential.type === 'public' 
                                            ? 'bg-blue-100 text-blue-700' 
                                            : 'bg-purple-100 text-purple-700'
                                        }`}>
                                          {credential.type === 'public' ? 'Public' : 'Private'}
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center gap-2">
                                        {/* Update Button */}
                                        <button
                                          onClick={() => handleEditJenkinsCredential(credential)}
                                          disabled={isSyncing || editingJenkinsId === jenkinsId}
                                          className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-150 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 hover:border-orange-300"
                                          title="Update Jenkins configuration"
                                        >
                                          <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                            />
                                          </svg>
                                          <span className="hidden sm:inline">Update</span>
                                        </button>
                                        
                                        {/* Sync/Reload Button */}
                                        <button
                                          onClick={() => handleSyncJenkinsJobs(credential)}
                                          disabled={isSyncing}
                                          className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-150 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300"
                                          title="Sync jobs/pipelines from Jenkins"
                                        >
                                          {isSyncing ? (
                                            <>
                                              <span className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></span>
                                              <span className="hidden sm:inline">Syncing...</span>
                                            </>
                                          ) : (
                                            <>
                                              <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                                />
                                              </svg>
                                              <span>Sync</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                    
                                    {/* Sync Status Message */}
                                    {syncMessage && (
                                      <div className={`mt-2 px-3 py-2 rounded-lg text-xs ${
                                        isSuccessMessage 
                                          ? 'bg-green-50 border border-green-200 text-green-700' 
                                          : 'bg-red-50 border border-red-200 text-red-700'
                                      }`}>
                                        {syncMessage}
                                      </div>
                                    )}
                                    
                                    <div className="space-y-1 mt-2">
                                      <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <span className="font-medium min-w-[100px]">Jenkins URL:</span>
                                        <span className="text-slate-800 break-all">{credential.jenkins_url || 'N/A'}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <span className="font-medium min-w-[100px]">Username:</span>
                                        <span className="text-slate-800">{credential.username || 'N/A'}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <span className="font-medium min-w-[100px]">Token:</span>
                                        <span className="text-slate-800">
                                          {credential.token ? (
                                            credential.token.length > 8 ? (
                                              <span className="font-mono">
                                                {credential.token.substring(0, 4)}••••••••{credential.token.substring(credential.token.length - 4)}
                                              </span>
                                            ) : (
                                              <span className="font-mono">••••••••</span>
                                            )
                                          ) : (
                                            <span className="text-slate-400 italic">Not set</span>
                                          )}
                                        </span>
                                      </div>
                                      {credential.user_name && (
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                          <span className="font-medium min-w-[100px]">User:</span>
                                          <span className="text-slate-800">{credential.user_name}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="mb-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <p className="text-sm text-slate-600">No Jenkins configurations saved yet.</p>
                        </div>
                      )}

                      {/* Jenkins Configuration Form */}
                      <div className="bg-white/80 rounded-lg border border-blue-200/30 overflow-hidden transition-colors duration-150">
                        {/* Clickable Header */}
                        <button
                          onClick={() => {
                            if (editingJenkinsId) {
                              handleCancelEditJenkins()
                            }
                            setExpandedJenkins(!expandedJenkins)
                          }}
                          className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-white/90 transition-colors duration-150"
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <img
                              src="https://upload.wikimedia.org/wikipedia/commons/e/e9/Jenkins_logo.svg"
                              alt="Jenkins"
                              className="w-10 h-10 sm:w-12 sm:h-12 object-contain flex-shrink-0"
                              onError={(e) => {
                                e.target.style.display = 'none'
                              }}
                            />
                            <div className="text-left min-w-0">
                              <h5 className="text-base sm:text-lg font-semibold text-slate-800 mb-1">
                                {editingJenkinsId ? 'Update Jenkins Configuration' : 'Add Jenkins Configuration'}
                              </h5>
                              <p className="text-xs sm:text-sm text-slate-600">
                                {editingJenkinsId 
                                  ? 'Update your Jenkins server configuration'
                                  : 'Configure your Jenkins server URL, credentials, and access type'}
                              </p>
                            </div>
                          </div>
                          <svg
                            className={`w-6 h-6 text-slate-600 transition-transform duration-150 ${
                              expandedJenkins ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>

                        {/* Expandable Form */}
                        {expandedJenkins && (
                          <div className="px-4 pb-4 border-t border-blue-200/30 pt-4 transition-colors duration-150 ease-in-out">
                            {editingJenkinsId && (
                              <div className="mb-4 flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                <p className="text-sm text-orange-700">
                                  <span className="font-medium">Editing mode:</span> Updating existing configuration. Leave token empty to keep current value.
                                </p>
                                <button
                                  type="button"
                                  onClick={handleCancelEditJenkins}
                                  className="text-orange-700 hover:text-orange-900 transition-colors"
                                  title="Cancel editing"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            )}
                            <form onSubmit={handleJenkinsSubmit} className="space-y-4">
                              {/* Jenkins URL */}
                              <div className="flex flex-col gap-2">
                                <label
                                  htmlFor="jenkinsUrl"
                                  className="text-sm font-semibold text-slate-700 uppercase tracking-wider"
                                >
                                  Jenkins URL <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="url"
                                  id="jenkinsUrl"
                                  name="jenkins_url"
                                  value={jenkinsCredentials.jenkins_url}
                                  onChange={handleJenkinsCredentialsChange}
                                  className="w-full px-3 py-2 bg-white border border-[#2196F3]/20 text-slate-800 text-sm transition-colors duration-150 outline-none shadow-sm placeholder:text-slate-400 focus:border-[#2196F3] focus:shadow-[0_0_0_2px_rgba(33,150,243,0.08)]"
                                  style={{ borderRadius: '6px 12px 6px 12px' }}
                                  placeholder="https://jenkins.example.com"
                                  required
                                />
                              </div>

                              {/* Username */}
                              <div className="flex flex-col gap-2">
                                <label
                                  htmlFor="jenkinsUsername"
                                  className="text-sm font-semibold text-slate-700 uppercase tracking-wider"
                                >
                                  Username <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  id="jenkinsUsername"
                                  name="username"
                                  value={jenkinsCredentials.username}
                                  onChange={handleJenkinsCredentialsChange}
                                  className="w-full px-3 py-2 bg-white border border-[#2196F3]/20 text-slate-800 text-sm transition-colors duration-150 outline-none shadow-sm placeholder:text-slate-400 focus:border-[#2196F3] focus:shadow-[0_0_0_2px_rgba(33,150,243,0.08)]"
                                  style={{ borderRadius: '6px 12px 6px 12px' }}
                                  placeholder="Enter Jenkins username"
                                  required
                                />
                              </div>

                              {/* Token */}
                              <div className="flex flex-col gap-2">
                                <label
                                  htmlFor="jenkinsToken"
                                  className="text-sm font-semibold text-slate-700 uppercase tracking-wider"
                                >
                                  Token {!editingJenkinsId && <span className="text-red-500">*</span>}
                                  {editingJenkinsId && <span className="text-slate-400 text-xs">(Leave empty to keep current)</span>}
                                </label>
                                <input
                                  type="password"
                                  id="jenkinsToken"
                                  name="token"
                                  value={jenkinsCredentials.token}
                                  onChange={handleJenkinsCredentialsChange}
                                  className="w-full px-3 py-2 bg-white border border-[#2196F3]/20 text-slate-800 text-sm transition-colors duration-150 outline-none shadow-sm placeholder:text-slate-400 focus:border-[#2196F3] focus:shadow-[0_0_0_2px_rgba(33,150,243,0.08)]"
                                  style={{ borderRadius: '6px 12px 6px 12px' }}
                                  placeholder={editingJenkinsId ? "Enter new token (leave empty to keep current)" : "Enter Jenkins API token"}
                                  required={!editingJenkinsId}
                                />
                              </div>

                              {/* Type (Private/Public) */}
                              <div className="flex flex-col gap-2">
                                <label
                                  htmlFor="jenkinsType"
                                  className="text-sm font-semibold text-slate-700 uppercase tracking-wider"
                                >
                                  Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                  id="jenkinsType"
                                  name="type"
                                  value={jenkinsCredentials.type}
                                  onChange={handleJenkinsCredentialsChange}
                                  className="w-full px-4 py-3 bg-white border border-[#2196F3]/20 text-slate-800 text-base transition-colors duration-150 outline-none shadow-sm focus:border-[#2196F3] focus:shadow-[0_0_0_2px_rgba(33,150,243,0.08)]"
                                  style={{ borderRadius: '6px 12px 6px 12px' }}
                                  required
                                >
                                  <option value="public">Public</option>
                                  <option value="private">Private</option>
                                </select>
                              </div>

                              {jenkinsError && (
                                <div
                                  className="flex items-center gap-2 px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg"
                                  role="alert"
                                >
                                  <span>⚠️</span>
                                  <span>{jenkinsError}</span>
                                </div>
                              )}

                              {jenkinsSuccess && (
                                <div
                                  className="flex items-center gap-2 px-4 py-3 text-sm bg-green-50 border border-green-200 text-green-700 rounded-lg"
                                  role="alert"
                                >
                                  <span>✅</span>
                                  <span>{jenkinsSuccess}</span>
                                </div>
                              )}

                              <div className="flex items-center gap-3">
                                {editingJenkinsId && (
                                  <button
                                    type="button"
                                    onClick={handleCancelEditJenkins}
                                    disabled={isSubmittingJenkins}
                                    className="px-6 py-3 bg-white border border-slate-300 text-slate-700 text-base font-medium rounded-lg hover:bg-slate-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Cancel
                                  </button>
                                )}
                                <button
                                  type="submit"
                                  disabled={isSubmittingJenkins}
                                  className="flex-1 px-6 py-3 bg-gradient-to-r from-[#42A5F5] to-[#66BB6A] text-white text-base font-semibold cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden group hover:from-[#1E88E5] hover:to-[#4CAF50] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                                  style={{ borderRadius: '12px 4px 12px 4px' }}
                                >
                                  {isSubmittingJenkins ? (
                                    <>
                                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                                      {editingJenkinsId ? 'Updating...' : 'Saving...'}
                                    </>
                                  ) : (
                                    <>
                                      <span>{editingJenkinsId ? 'Update Jenkins Configuration' : 'Save Jenkins Configuration'}</span>
                                      <span className="text-xl transition-transform duration-300 group-hover:translate-x-1">
                                        →
                                      </span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
    </PageLayout>
  )
}

export default SettingsPage

