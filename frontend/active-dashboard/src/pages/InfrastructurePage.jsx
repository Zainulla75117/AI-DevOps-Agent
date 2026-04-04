import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import PageLayout from '../components/PageLayout'

const InfrastructurePage = () => {
  const { userInfo, handleLogout } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    // Step 1: Basic Information
    projectName: '',
    infrastructureName: '',
    infrastructureType: '',
    // Step 2: Configuration
    region: '',
    environment: '',
    description: '',
    // Step 3: Resources
    resourceCount: '',
    resourceType: '',
  })

  useEffect(() => {
    document.title = 'DevOps Infinity - Infrastructure'
  }, [])

  const steps = [
    { number: 1, title: 'Basic Information' },
    { number: 2, title: 'Configuration' },
    { number: 3, title: 'Resources' },
  ]

  const totalSteps = steps.length

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Logic will be added later
    console.log('Form submitted:', formData)
  }

  return (
    <PageLayout userInfo={userInfo} onLogout={handleLogout}>
      <main className="flex-1 overflow-y-auto p-6 bg-slate-50/50 backdrop-blur-3xl w-full">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Create Infrastructure</h1>
            <p className="text-slate-600">Fill in the details to create your infrastructure</p>
          </div>

          {/* Stepper Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold tracking-tight transition-all duration-500 shadow-sm ${
                        currentStep >= step.number
                          ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500/20'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {currentStep > step.number ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        step.number
                      )}
                    </div>
                    <span
                      className={`mt-2 text-xs sm:text-sm font-medium ${
                        currentStep >= step.number ? 'text-slate-800' : 'text-slate-500'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-1 flex-1 mx-2 rounded-full transition-all duration-500 ${
                        currentStep > step.number ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] border border-white/60 p-8 sm:p-10 transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(33,150,243,0.1)] hover:border-blue-100 mb-10">
            <form onSubmit={handleSubmit}>
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6">Basic Information</h2>
                  
                  <div className="flex flex-col gap-2">
                    <label htmlFor="projectName" className="text-sm font-semibold text-slate-700">
                      Project Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="projectName"
                      name="projectName"
                      value={formData.projectName}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3.5 bg-white/70 backdrop-blur-md border border-slate-200 text-slate-800 text-sm font-medium rounded-xl transition-all duration-300 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 shadow-sm hover:border-blue-300"
                      placeholder="Enter project name"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="infrastructureName" className="text-sm font-semibold text-slate-700">
                      Infrastructure Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="infrastructureName"
                      name="infrastructureName"
                      value={formData.infrastructureName}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3.5 bg-white/70 backdrop-blur-md border border-slate-200 text-slate-800 text-sm font-medium rounded-xl transition-all duration-300 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 shadow-sm hover:border-blue-300"
                      placeholder="Enter infrastructure name"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="infrastructureType" className="text-sm font-semibold text-slate-700">
                      Infrastructure Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="infrastructureType"
                      name="infrastructureType"
                      value={formData.infrastructureType}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3.5 bg-white/70 backdrop-blur-md border border-slate-200 text-slate-800 text-sm font-medium rounded-xl transition-all duration-300 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 shadow-sm hover:border-blue-300"
                      required
                    >
                      <option value="">Select infrastructure type</option>
                      <option value="network">Network</option>
                      <option value="servers">Servers</option>
                      <option value="serverless">Serverless</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Step 2: Configuration */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6">Configuration</h2>
                  
                  <div className="flex flex-col gap-2">
                    <label htmlFor="region" className="text-sm font-semibold text-slate-700">
                      Region <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="region"
                      name="region"
                      value={formData.region}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3.5 bg-white/70 backdrop-blur-md border border-slate-200 text-slate-800 text-sm font-medium rounded-xl transition-all duration-300 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 shadow-sm hover:border-blue-300"
                      required
                    >
                      <option value="">Select region</option>
                      <option value="us-east-1">US East (N. Virginia)</option>
                      <option value="us-west-2">US West (Oregon)</option>
                      <option value="eu-west-1">Europe (Ireland)</option>
                      <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="environment" className="text-sm font-semibold text-slate-700">
                      Environment <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="environment"
                      name="environment"
                      value={formData.environment}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3.5 bg-white/70 backdrop-blur-md border border-slate-200 text-slate-800 text-sm font-medium rounded-xl transition-all duration-300 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 shadow-sm hover:border-blue-300"
                      required
                    >
                      <option value="">Select environment</option>
                      <option value="development">Development</option>
                      <option value="staging">Staging</option>
                      <option value="production">Production</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="description" className="text-sm font-semibold text-slate-700">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-5 py-3.5 bg-white/70 backdrop-blur-md border border-slate-200 text-slate-800 text-sm font-medium rounded-xl transition-all duration-300 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 shadow-sm hover:border-blue-300 resize-none"
                      placeholder="Enter description (optional)"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Resources */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6">Resources</h2>
                  
                  <div className="flex flex-col gap-2">
                    <label htmlFor="resourceType" className="text-sm font-semibold text-slate-700">
                      Resource Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="resourceType"
                      name="resourceType"
                      value={formData.resourceType}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3.5 bg-white/70 backdrop-blur-md border border-slate-200 text-slate-800 text-sm font-medium rounded-xl transition-all duration-300 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 shadow-sm hover:border-blue-300"
                      required
                    >
                      <option value="">Select resource type</option>
                      <option value="compute">Compute</option>
                      <option value="storage">Storage</option>
                      <option value="database">Database</option>
                      <option value="network">Network</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="resourceCount" className="text-sm font-semibold text-slate-700">
                      Resource Count <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="resourceCount"
                      name="resourceCount"
                      value={formData.resourceCount}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-5 py-3.5 bg-white/70 backdrop-blur-md border border-slate-200 text-slate-800 text-sm font-medium rounded-xl transition-all duration-300 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 shadow-sm hover:border-blue-300"
                      placeholder="Enter number of resources"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                    currentStep === 1
                      ? 'bg-slate-100/50 text-slate-400 cursor-not-allowed'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:shadow-sm'
                  }`}
                >
                  Previous
                </button>

                <div className="text-sm text-slate-600">
                  Step {currentStep} of {totalSteps}
                </div>

                {currentStep < totalSteps ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl transition-all duration-300 hover:bg-blue-700 hover:shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] hover:-translate-y-0.5"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl transition-all duration-300 hover:bg-blue-700 hover:shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] hover:-translate-y-0.5"
                  >
                    Create Infrastructure
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </main>
    </PageLayout>
  )
}

export default InfrastructurePage

