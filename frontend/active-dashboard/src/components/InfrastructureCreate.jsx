import { useState, useEffect } from 'react'
import { fetchProjects } from '../services/projectService'
import { createNetworkInfrastructure } from '../services/infrastructureService'

const InfrastructureCreate = ({ selectedOption, onInfrastructureCreated, onCancel }) => {
  const [projects, setProjects] = useState([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [networkFormData, setNetworkFormData] = useState({
    projectName: '',
    vpcName: '',
    vpcCidr: '',
    natGateway: 'no',
    publicSubnetCount: 1,
    privateSubnetCount: 1,
    availabilityZones: 1,
    natGatewayAzCount: 1,
    enableDnsHostnames: true,
    enableDnsSupport: true,
  })

  const cidrOptions = [
    '10.0.0.0/16',
    '172.16.0.0/16',
    '192.168.0.0/16',
    '10.1.0.0/16',
    '172.31.0.0/16',
  ]

  useEffect(() => {
    // Fetch projects from backend when component mounts
    const loadProjects = async () => {
      setIsLoadingProjects(true)
      try {
        const response = await fetchProjects()
        // Extract only project names from the response
        const projectNames = (response.projects || []).map((project) => ({
          project_name: project.project_name,
        }))
        setProjects(projectNames)
      } catch (error) {
        console.error('Error loading projects:', error)
        setProjects([])
      } finally {
        setIsLoadingProjects(false)
      }
    }
    loadProjects()
  }, [])

  const handleNetworkFormChange = (e) => {
    const { name, value, type, checked } = e.target
    if (type === 'checkbox') {
      setNetworkFormData((prev) => ({
        ...prev,
        [name]: checked,
      }))
    } else if (type === 'number') {
      setNetworkFormData((prev) => {
        const newData = {
          ...prev,
          [name]: parseInt(value) || 0,
        }
        // If availabilityZones changes and NAT Gateway is enabled, ensure natGatewayAzCount doesn't exceed it
        if (name === 'availabilityZones' && prev.natGateway === 'yes') {
          newData.natGatewayAzCount = Math.min(newData.natGatewayAzCount, newData.availabilityZones)
        }
        // If natGatewayAzCount changes, ensure it doesn't exceed availabilityZones
        if (name === 'natGatewayAzCount') {
          newData.natGatewayAzCount = Math.min(parseInt(value) || 1, prev.availabilityZones)
        }
        return newData
      })
    } else {
      setNetworkFormData((prev) => {
        const newData = {
          ...prev,
          [name]: value,
        }
        // Reset natGatewayAzCount to 1 when NAT Gateway is set to 'no'
        if (name === 'natGateway' && value === 'no') {
          newData.natGatewayAzCount = 1
        }
        // When NAT Gateway is set to 'yes', set natGatewayAzCount to match availabilityZones if it's higher
        if (name === 'natGateway' && value === 'yes') {
          newData.natGatewayAzCount = Math.min(prev.natGatewayAzCount, prev.availabilityZones) || 1
        }
        return newData
      })
    }
  }

  const handleNetworkSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      // Format payload according to backend structure
      const payload = {
        project_name: networkFormData.projectName,
        vpc_name: networkFormData.vpcName,
        vpc_cidr: networkFormData.vpcCidr,
        no_of_az: networkFormData.availabilityZones,
        public_subnet_count: networkFormData.publicSubnetCount,
        private_subnet_count: networkFormData.privateSubnetCount,
        nat_gateway: networkFormData.natGateway === 'no' 
          ? 'none' 
          : String(networkFormData.natGatewayAzCount), // Send count as string when yes
        enable_dns_hostname: networkFormData.enableDnsHostnames,
        enable_dns_support: networkFormData.enableDnsSupport,
      }

      // Send to backend API
      const response = await createNetworkInfrastructure(payload)

      // Get response message from backend
      const responseMessage = response?.message || response?.data?.message || 'Network infrastructure created successfully!'

      // Call the callback with response and message
      if (onInfrastructureCreated) {
        onInfrastructureCreated(
          {
            ...response,
            type: 'network',
            createdAt: new Date().toISOString(),
          },
          responseMessage
        )
      }

      // Reset form
      setNetworkFormData({
        projectName: '',
        vpcName: '',
        vpcCidr: '',
        natGateway: 'no',
        publicSubnetCount: 1,
        privateSubnetCount: 1,
        availabilityZones: 1,
        natGatewayAzCount: 1,
        enableDnsHostnames: true,
        enableDnsSupport: true,
      })
    } catch (err) {
      setError(err.message || 'Failed to create network infrastructure')
      setIsSubmitting(false)
    }
  }

  // Network Form - Full Width (4/4 ratio)
  if (selectedOption === 'network') {
    return (
      <div className="w-full">
        <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 sm:p-8 shadow-lg border border-[#2196F3]/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Create Network Infrastructure</h2>
            <button
              onClick={onCancel}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all duration-300"
            >
              ← Back
            </button>
          </div>

          <form onSubmit={handleNetworkSubmit} className="space-y-4 sm:space-y-6">
            {/* Project Name */}
            <div className="flex flex-col gap-2">
              <label htmlFor="projectName" className="text-xs sm:text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Project Name <span className="text-red-500">*</span>
              </label>
              {isLoadingProjects ? (
                <div className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-100 border border-[#2196F3]/20 text-slate-600 text-sm sm:text-base rounded-lg flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                  <span>Loading your  projects...</span>
                </div>
              ) : (
                <>
                  <select
                    id="projectName"
                    name="projectName"
                    value={networkFormData.projectName}
                    onChange={handleNetworkFormChange}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border border-[#2196F3]/20 text-slate-800 text-sm sm:text-base transition-all duration-300 outline-none shadow-sm focus:border-[#2196F3] focus:shadow-[0_0_0_4px_rgba(33,150,243,0.08),0_0_20px_rgba(33,150,243,0.12)] focus:-translate-y-0.5"
                    style={{ borderRadius: '6px 12px 6px 12px' }}
                    required
                  >
                    <option value="">Select a project</option>
                    {projects.map((project, index) => (
                      <option key={project.project_name || index} value={project.project_name}>
                        {project.project_name}
                      </option>
                    ))}
                  </select>
                  {!isLoadingProjects && projects.length === 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      No projects found. Please create a project first from the Dashboard.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* VPC Name */}
            <div className="flex flex-col gap-2">
              <label htmlFor="vpcName" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                VPC Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="vpcName"
                name="vpcName"
                value={networkFormData.vpcName}
                onChange={handleNetworkFormChange}
                className="w-full px-4 py-3 bg-white border border-[#2196F3]/20 text-slate-800 text-base transition-all duration-300 outline-none shadow-sm placeholder:text-slate-400 focus:border-[#2196F3] focus:shadow-[0_0_0_4px_rgba(33,150,243,0.08),0_0_20px_rgba(33,150,243,0.12)] focus:-translate-y-0.5"
                style={{ borderRadius: '6px 12px 6px 12px' }}
                placeholder="Enter VPC name"
                required
              />
            </div>

            {/* VPC CIDR */}
            <div className="flex flex-col gap-2">
              <label htmlFor="vpcCidr" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                VPC CIDR <span className="text-red-500">*</span>
              </label>
              <select
                id="vpcCidr"
                name="vpcCidr"
                value={networkFormData.vpcCidr}
                onChange={handleNetworkFormChange}
                className="w-full px-4 py-3 bg-white border border-[#2196F3]/20 text-slate-800 text-base transition-all duration-300 outline-none shadow-sm focus:border-[#2196F3] focus:shadow-[0_0_0_4px_rgba(33,150,243,0.08),0_0_20px_rgba(33,150,243,0.12)] focus:-translate-y-0.5"
                style={{ borderRadius: '6px 12px 6px 12px' }}
                required
              >
                <option value="">Select VPC CIDR</option>
                {cidrOptions.map((cidr) => (
                  <option key={cidr} value={cidr}>
                    {cidr}
                  </option>
                ))}
              </select>
            </div>

            {/* NAT Gateway */}
            <div className="flex flex-col gap-2">
              <label htmlFor="natGateway" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                NAT Gateway <span className="text-red-500">*</span>
              </label>
              <select
                id="natGateway"
                name="natGateway"
                value={networkFormData.natGateway}
                onChange={handleNetworkFormChange}
                className="w-full px-4 py-3 bg-white border border-[#2196F3]/20 text-slate-800 text-base transition-all duration-300 outline-none shadow-sm focus:border-[#2196F3] focus:shadow-[0_0_0_4px_rgba(33,150,243,0.08),0_0_20px_rgba(33,150,243,0.12)] focus:-translate-y-0.5"
                style={{ borderRadius: '6px 12px 6px 12px' }}
                required
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            {/* Count of Public Subnets */}
            <div className="flex flex-col gap-2">
              <label htmlFor="publicSubnetCount" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Count of Public Subnets <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="publicSubnetCount"
                name="publicSubnetCount"
                value={networkFormData.publicSubnetCount}
                onChange={handleNetworkFormChange}
                min="1"
                max="10"
                className="w-full px-4 py-3 bg-white border border-[#2196F3]/20 text-slate-800 text-base transition-all duration-300 outline-none shadow-sm placeholder:text-slate-400 focus:border-[#2196F3] focus:shadow-[0_0_0_4px_rgba(33,150,243,0.08),0_0_20px_rgba(33,150,243,0.12)] focus:-translate-y-0.5"
                style={{ borderRadius: '6px 12px 6px 12px' }}
                required
              />
            </div>

            {/* Count of Private Subnets */}
            <div className="flex flex-col gap-2">
              <label htmlFor="privateSubnetCount" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Count of Private Subnets <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="privateSubnetCount"
                name="privateSubnetCount"
                value={networkFormData.privateSubnetCount}
                onChange={handleNetworkFormChange}
                min="1"
                max="10"
                className="w-full px-4 py-3 bg-white border border-[#2196F3]/20 text-slate-800 text-base transition-all duration-300 outline-none shadow-sm placeholder:text-slate-400 focus:border-[#2196F3] focus:shadow-[0_0_0_4px_rgba(33,150,243,0.08),0_0_20px_rgba(33,150,243,0.12)] focus:-translate-y-0.5"
                style={{ borderRadius: '6px 12px 6px 12px' }}
                required
              />
            </div>

            {/* Availability Zones Count */}
            <div className="flex flex-col gap-2">
              <label htmlFor="availabilityZones" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Availability Zones Count <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="availabilityZones"
                name="availabilityZones"
                value={networkFormData.availabilityZones}
                onChange={handleNetworkFormChange}
                min="1"
                max="6"
                className="w-full px-4 py-3 bg-white border border-[#2196F3]/20 text-slate-800 text-base transition-all duration-300 outline-none shadow-sm placeholder:text-slate-400 focus:border-[#2196F3] focus:shadow-[0_0_0_4px_rgba(33,150,243,0.08),0_0_20px_rgba(33,150,243,0.12)] focus:-translate-y-0.5"
                style={{ borderRadius: '6px 12px 6px 12px' }}
                required
              />
            </div>

            {/* NAT Gateway AZ Count - Only show if NAT Gateway is Yes */}
            {networkFormData.natGateway === 'yes' && (
              <div className="flex flex-col gap-2">
                <label htmlFor="natGatewayAzCount" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  NAT Gateway in how many AZs <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="natGatewayAzCount"
                  name="natGatewayAzCount"
                  value={networkFormData.natGatewayAzCount}
                  onChange={handleNetworkFormChange}
                  min="1"
                  max={networkFormData.availabilityZones}
                  className="w-full px-4 py-3 bg-white border border-[#2196F3]/20 text-slate-800 text-base transition-all duration-300 outline-none shadow-sm placeholder:text-slate-400 focus:border-[#2196F3] focus:shadow-[0_0_0_4px_rgba(33,150,243,0.08),0_0_20px_rgba(33,150,243,0.12)] focus:-translate-y-0.5"
                  style={{ borderRadius: '6px 12px 6px 12px' }}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Maximum: {networkFormData.availabilityZones} (based on Availability Zones Count)
                </p>
              </div>
            )}

            {/* DNS Hostnames */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enableDnsHostnames"
                name="enableDnsHostnames"
                checked={networkFormData.enableDnsHostnames}
                onChange={handleNetworkFormChange}
                className="w-5 h-5 text-[#2196F3] border-[#2196F3]/20 rounded focus:ring-[#1E88E5] focus:ring-2"
              />
              <label htmlFor="enableDnsHostnames" className="text-sm font-semibold text-slate-700 uppercase tracking-wider cursor-pointer">
                Enable DNS Hostnames
              </label>
            </div>

            {/* DNS Support */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enableDnsSupport"
                name="enableDnsSupport"
                checked={networkFormData.enableDnsSupport}
                onChange={handleNetworkFormChange}
                className="w-5 h-5 text-[#2196F3] border-[#2196F3]/20 rounded focus:ring-[#1E88E5] focus:ring-2"
              />
              <label htmlFor="enableDnsSupport" className="text-sm font-semibold text-slate-700 uppercase tracking-wider cursor-pointer">
                Enable DNS Support
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className="flex items-center gap-2 px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg"
                role="alert"
              >
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-[#42A5F5] to-[#66BB6A] text-white text-sm sm:text-base font-semibold cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden group hover:from-[#1E88E5] hover:to-[#4CAF50] hover:shadow-lg active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
                style={{ borderRadius: '12px 4px 12px 4px' }}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Creating...
                  </>
                ) : (
                  <>
                    <span>Create Network</span>
                    <span className="text-xl transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </>
                )}
              </button>
              <button
                type="button"
              onClick={() => {
                onCancel()
                setNetworkFormData({
                  projectName: '',
                  vpcName: '',
                  vpcCidr: '',
                  natGateway: 'no',
                  publicSubnetCount: 1,
                  privateSubnetCount: 1,
                  availabilityZones: 1,
                  natGatewayAzCount: 1,
                  enableDnsHostnames: true,
                  enableDnsSupport: true,
                })
              }}
                className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-white border border-slate-300 text-slate-700 text-sm sm:text-base font-medium rounded-lg hover:bg-slate-50 transition-all duration-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // Servers Form Placeholder
  if (selectedOption === 'servers') {
    return (
      <div className="w-full">
        <div className="bg-white/80 backdrop-blur-lg rounded-xl p-8 shadow-lg border border-[#2196F3]/20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Create Servers Infrastructure</h2>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all duration-300"
            >
              ← Back
            </button>
          </div>
          <p className="text-slate-600">Server creation form will be implemented here.</p>
        </div>
      </div>
    )
  }

  // Serverless Form Placeholder
  if (selectedOption === 'serverless') {
    return (
      <div className="w-full">
        <div className="bg-white/80 backdrop-blur-lg rounded-xl p-8 shadow-lg border border-[#2196F3]/20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Create Serverless Infrastructure</h2>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all duration-300"
            >
              ← Back
            </button>
          </div>
          <p className="text-slate-600">Serverless creation form will be implemented here.</p>
        </div>
      </div>
    )
  }

  return null
}

export default InfrastructureCreate

