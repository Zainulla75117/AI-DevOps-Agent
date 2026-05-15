import { useState, useEffect } from 'react'
import { createProject } from '../services/projectService'
import { getCloudCredentials, getSCMRepos } from '../services/credentialService'

const ProjectCreate = ({ onProjectCreated, onCancel }) => {
  const [formData, setFormData] = useState({
    projectName: '',
    description: '',
    projectType: 'web',
    primaryEnvironment: 'dev',
    expectedTraffic: 'medium',
    costPreference: 'balanced',
    platform: 'cloud',
    cloudProvider: 'aws',
    region: 'us-east-1',
    iamName: '',
    linkedRepositories: [],
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cloudCredentials, setCloudCredentials] = useState([])
  const [isLoadingCreds, setIsLoadingCreds] = useState(false)
  const [scmRepos, setScmRepos] = useState([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)

  useEffect(() => {
    const fetchCredsAndRepos = async () => {
      setIsLoadingCreds(true)
      setIsLoadingRepos(true)
      try {
        const creds = await getCloudCredentials()
        const credsArray = Array.isArray(creds) ? creds : (creds.data || [])
        setCloudCredentials(credsArray)
      } catch (err) {
        console.error('Failed to fetch cloud credentials:', err)
        setCloudCredentials([])
      } finally {
        setIsLoadingCreds(false)
      }

      try {
        const repos = await getSCMRepos()
        const reposArray = Array.isArray(repos) ? repos : (repos.data || [])
        setScmRepos(reposArray)
      } catch (err) {
        console.error('Failed to fetch repos:', err)
        setScmRepos([])
      } finally {
        setIsLoadingRepos(false)
      }
    }
    fetchCredsAndRepos()
  }, [])

  const projectTypeOptions = [
    { value: 'web', label: 'Web Application' },
    { value: 'api', label: 'Backend API' },
    { value: 'microservices', label: 'Microservices' },
    { value: 'data', label: 'Data / Pipeline' },
  ]

  const environmentOptions = [
    { value: 'dev', label: 'Dev' },
    { value: 'prod', label: 'Prod' },
  ]

  const trafficOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ]

  const costPreferenceOptions = [
    { value: 'cost-optimised', label: 'Cost-Optimised' },
    { value: 'balanced', label: 'Balanced' },
    { value: 'performance-first', label: 'Performance-First' },
  ]

  const cloudProviderOptions = [
    { value: 'aws', label: 'Amazon Web Services (AWS)' },
    { value: 'azure', label: 'Microsoft Azure' },
    { value: 'gcp', label: 'Google Cloud Platform' },
  ]

  const regionOptions = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'eu-west-1', label: 'Europe (Ireland)' },
    { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  ]

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = {}

    // Validation
    if (!formData.projectName.trim()) {
      newErrors.projectName = 'Project name is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)

    try {
      // Map new form fields to backend format
      const projectData = {
        projectName: formData.projectName.trim(),
        description: formData.description.trim() || '',
        environment: formData.primaryEnvironment === 'dev' ? 'development' : 'production',
        domain: formData.projectType,
        expectedTraffic: formData.expectedTraffic,
        costPreference: formData.costPreference,
        platform: formData.platform,
        cloudProvider: formData.cloudProvider,
        region: formData.region,
        iamName: formData.iamName,
        linkedRepositories: formData.linkedRepositories || [],
      }

      const response = await createProject(projectData)

      // Reset form
      setFormData({
        projectName: '',
        description: '',
        projectType: 'web',
        primaryEnvironment: 'dev',
        expectedTraffic: 'medium',
        costPreference: 'balanced',
        platform: 'cloud',
        cloudProvider: 'aws',
        region: 'us-east-1',
        iamName: '',
        linkedRepositories: [],
      })
      setErrors({})

      if (onProjectCreated) {
        const responseMessage = response?.message || response?.data?.message || 'Project created successfully!'
        onProjectCreated(response, responseMessage)
      }
    } catch (err) {
      setErrors({ submit: err.message || 'Failed to create project' })
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-display">Create New Project</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Define what you're building. Infrastructure comes next.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Project Name */}
        <div>
          <label htmlFor="projectName" className="block text-sm font-semibold text-slate-900 mb-2">
            Project Name <span className="text-red-500 font-normal">*</span>
          </label>
          <input
            type="text"
            id="projectName"
            name="projectName"
            value={formData.projectName}
            onChange={handleChange}
            className={`w-full px-4 py-2.5 text-sm border rounded-xl transition-all duration-200 ${
              errors.projectName
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50'
                : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500 bg-white'
            } focus:outline-none focus:ring-2 focus:ring-offset-0 placeholder:text-slate-400`}
            placeholder="my-project-1"
            required
          />
          {errors.projectName && (
            <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {errors.projectName}
            </p>
          )}
        </div>

        {/* Project Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-semibold text-slate-900 mb-2">
            Project Description <span className="text-slate-400 text-xs font-normal">(optional)</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500 resize-none transition-all duration-200 placeholder:text-slate-400 bg-white"
            placeholder="Brief description of your project"
          />
        </div>

        {/* Project Type */}
        <div>
          <label htmlFor="projectType" className="block text-sm font-semibold text-slate-900 mb-2">
            Project Type
          </label>
          <select
            id="projectType"
            name="projectType"
            value={formData.projectType}
            onChange={handleChange}
            className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 bg-white cursor-pointer"
          >
            {projectTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Primary Environment */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-3">
            Primary Environment
          </label>
          <div className="flex gap-3">
            {environmentOptions.map((option) => (
              <label
                key={option.value}
                className={`flex-1 flex items-center justify-center gap-2 p-3 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                  formData.primaryEnvironment === option.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="primaryEnvironment"
                  value={option.value}
                  checked={formData.primaryEnvironment === option.value}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 focus:ring-2"
                />
                <span className={`text-sm font-medium ${
                  formData.primaryEnvironment === option.value ? 'text-blue-700' : 'text-slate-700'
                }`}>
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Expected Traffic */}
        <div>
          <label htmlFor="expectedTraffic" className="block text-sm font-semibold text-slate-900 mb-2">
            Expected Traffic
          </label>
          <select
            id="expectedTraffic"
            name="expectedTraffic"
            value={formData.expectedTraffic}
            onChange={handleChange}
            className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 bg-white cursor-pointer"
          >
            {trafficOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Cost Preference */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-3">
            Cost Preference
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {costPreferenceOptions.map((option) => (
              <label
                key={option.value}
                className={`relative flex items-center justify-center px-3 py-2.5 text-xs font-semibold rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  formData.costPreference === option.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="costPreference"
                  value={option.value}
                  checked={formData.costPreference === option.value}
                  onChange={handleChange}
                  className="sr-only"
                />
                <span className="text-center leading-tight">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Platform (read-only) */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Platform
          </label>
          <div className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-700 cursor-default">
            Cloud
          </div>
        </div>

        {/* Cloud Provider */}
        <div>
          <label htmlFor="cloudProvider" className="block text-sm font-semibold text-slate-900 mb-2">
            Cloud Provider
          </label>
          <select
            id="cloudProvider"
            name="cloudProvider"
            value={formData.cloudProvider}
            onChange={handleChange}
            className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 bg-white cursor-pointer"
          >
            {cloudProviderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Region */}
        <div>
          <label htmlFor="region" className="block text-sm font-semibold text-slate-900 mb-2">
            Region
          </label>
          <select
            id="region"
            name="region"
            value={formData.region}
            onChange={handleChange}
            className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 bg-white cursor-pointer"
          >
            {regionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* IAM User Name */}
        <div>
          <label htmlFor="iamName" className="block text-sm font-semibold text-slate-900 mb-2">
            IAM User Name <span className="text-slate-400 text-xs font-normal">(optional)</span>
          </label>
          {isLoadingCreds ? (
            <div className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-400 flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-500 rounded-full animate-spin"></span>
              Loading credentials...
            </div>
          ) : cloudCredentials.length > 0 ? (
            <select
              id="iamName"
              name="iamName"
              value={formData.iamName}
              onChange={handleChange}
              className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 bg-white cursor-pointer"
            >
              <option value="">Select IAM User</option>
              {cloudCredentials.map((cred, idx) => (
                <option key={cred.id || cred._id || idx} value={cred.name}>
                  {cred.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-500">
              No cloud credentials saved. <span className="text-blue-600 font-medium">Add them in Settings → Cloud Credentials.</span>
            </div>
          )}
        </div>

        {/* Linked Repositories */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Link Repositories <span className="text-slate-400 text-xs font-normal">(optional)</span>
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Select repositories to automatically target during resource creation.
          </p>
          
          {isLoadingRepos ? (
            <div className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-400 flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-500 rounded-full animate-spin"></span>
              Loading repositories...
            </div>
          ) : scmRepos.length > 0 ? (
            <div className="w-full max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50 p-2 space-y-1">
              {scmRepos.map((repo) => {
                const isSelected = (formData.linkedRepositories || []).some(
                  r => r.repo_full_name === repo.name_with_namespace
                )
                
                return (
                  <label 
                    key={repo.id} 
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors duration-150 ${
                      isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData(prev => {
                          const currentRepos = prev.linkedRepositories || [];
                          if (checked) {
                            return {
                              ...prev,
                              linkedRepositories: [...currentRepos, {
                                repo_full_name: repo.name_with_namespace,
                                credential_id: repo.scm_id,
                                provider: repo.scm_provider,
                                repo_id: repo.id || null
                              }]
                            };
                          } else {
                            return {
                              ...prev,
                              linkedRepositories: currentRepos.filter(
                                r => r.repo_full_name !== repo.name_with_namespace
                              )
                            };
                          }
                        });
                      }}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {repo.name_with_namespace}
                      </p>
                      <p className="text-xs text-slate-500 truncate capitalize">
                        {repo.scm_provider}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          ) : (
            <div className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-500">
              No synced repositories found. <span className="text-blue-600 font-medium">Sync them in Settings → SCM Integrations.</span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {errors.submit && (
          <div className="px-4 py-3 text-sm bg-red-50 border-2 border-red-200 text-red-700 rounded-xl flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{errors.submit}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-2 space-y-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md disabled:hover:shadow-sm"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Creating Project...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Create Project & Continue
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            )}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full px-4 py-2.5 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors duration-200"
            >
              Cancel
            </button>
          )}
          <p className="text-xs text-center text-slate-500 pt-1">
            You can configure infrastructure in the next step.
          </p>
        </div>
      </form>
    </div>
  )
}

export default ProjectCreate
