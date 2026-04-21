import { useState, useEffect } from 'react'
import { fetchProjects } from '../services/projectService'
import { 
  createNetworkInfrastructure, 
  createServersInfrastructure,
  createServerlessInfrastructure,
  createCloudManagedInfrastructure,
  getResourcesByProject
} from '../services/infrastructureService'

// ── Reusable UI Components ────────────────────────────────────────
const inputClass = 'w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 bg-white placeholder:text-slate-400'
const selectClass = 'w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 bg-white cursor-pointer'
const labelClass = 'block text-sm font-semibold text-slate-900 mb-2'

const FormCard = ({ icon, iconGradient, title, subtitle, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 bg-gradient-to-br ${iconGradient} rounded-lg flex items-center justify-center text-white shadow-sm`}>
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 font-display">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
    {children}
  </div>
)

const ProjectField = ({ preSelectedProject, isLoadingProjects, projects, value, onChange }) => (
  <div>
    <label className={labelClass}>
      Project <span className="text-red-500 font-normal">*</span>
    </label>
    {preSelectedProject ? (
      <div className="w-full px-4 py-2.5 bg-blue-50 border border-blue-200 text-sm rounded-xl flex items-center gap-2">
        <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span className="font-semibold text-slate-800">{preSelectedProject}</span>
      </div>
    ) : isLoadingProjects ? (
      <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 text-sm rounded-xl flex items-center gap-2 text-slate-500">
        <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
        Loading projects...
      </div>
    ) : (
      <>
        <select
          name="projectName"
          value={value}
          onChange={onChange}
          className={selectClass}
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
          <p className="text-xs text-slate-500 mt-1.5">
            No projects found. Create a project from the Dashboard first.
          </p>
        )}
      </>
    )}
  </div>
)

const ToggleSwitch = ({ name, checked, onChange, label }) => (
  <div className="flex items-center justify-between py-2">
    <label htmlFor={name} className="text-sm font-medium text-slate-700 cursor-pointer">
      {label}
    </label>
    <button
      type="button"
      id={name}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange({ target: { name, type: 'checkbox', checked: !checked } })}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? 'bg-blue-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
)

const PillToggle = ({ name, value, onChange, options }) => (
  <div className="flex gap-2">
    {options.map((option) => (
      <label
        key={option.value}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 rounded-xl cursor-pointer transition-all duration-200 text-sm font-medium ${
          value === option.value
            ? 'border-blue-500 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
        }`}
      >
        <input
          type="radio"
          name={name}
          value={option.value}
          checked={value === option.value}
          onChange={onChange}
          className="sr-only"
        />
        {option.label}
      </label>
    ))}
  </div>
)

const SubmitButton = ({ label, submittingLabel, isSubmitting, onCancel }) => (
  <div className="pt-3 space-y-3">
    <button
      type="submit"
      disabled={isSubmitting}
      className="group w-full px-4 py-3 bg-gradient-to-br from-[#42A5F5] to-[#30705d] hover:from-[#1E88E5] hover:to-[#215646] text-white text-sm font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-[#30705d]/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md disabled:hover:shadow-sm"
    >
      {isSubmitting ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          {submittingLabel || 'Creating...'}
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          {label}
          <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  </div>
)

const ErrorAlert = ({ error }) =>
  error ? (
    <div className="px-4 py-3 text-sm bg-red-50 border-2 border-red-200 text-red-700 rounded-xl flex items-center gap-2">
      <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
      <span>{error}</span>
    </div>
  ) : null

const InfrastructureCreate = ({ selectedOption, onInfrastructureCreated, onCancel, preSelectedProject, preSelectedProjectId, preSelectedProjectData }) => {
  const [projects, setProjects] = useState([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // ── Form Data States ──────────────────────────────────────────────
  const [networkFormData, setNetworkFormData] = useState({
    projectName: preSelectedProject || '',
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

  const [serversFormData, setServersFormData] = useState({
    projectName: preSelectedProject || '',
    networkId: '',
    instanceType: 't3.micro',
    instanceCount: 1,
    osImage: 'amazon-linux-2',
    storageSize: 20,
    keyPairName: '',
  })

  // Network resources for the current project (used in servers form)
  const [networkOptions, setNetworkOptions] = useState([])
  const [isLoadingNetworks, setIsLoadingNetworks] = useState(false)

  const [serverlessFormData, setServerlessFormData] = useState({
    projectName: preSelectedProject || '',
    runtime: 'nodejs18.x',
    memorySize: 128,
    timeout: 30,
    handler: 'index.handler',
    description: '',
  })

  const [cloudManagedFormData, setCloudManagedFormData] = useState({
    projectName: preSelectedProject || '',
    serviceType: 'rds',
    instanceClass: 'db.t3.micro',
    storageSize: 20,
    serviceName: '',
  })

  // ── Options ───────────────────────────────────────────────────────
  const cidrOptions = [
    '10.0.0.0/16',
    '172.16.0.0/16',
    '192.168.0.0/16',
    '10.1.0.0/16',
    '172.31.0.0/16',
  ]

  const instanceTypeOptions = [
    { value: 't3.micro', label: 't3.micro — 2 vCPU, 1 GB' },
    { value: 't3.small', label: 't3.small — 2 vCPU, 2 GB' },
    { value: 't3.medium', label: 't3.medium — 2 vCPU, 4 GB' },
    { value: 't3.large', label: 't3.large — 2 vCPU, 8 GB' },
    { value: 'm5.large', label: 'm5.large — 2 vCPU, 8 GB' },
    { value: 'm5.xlarge', label: 'm5.xlarge — 4 vCPU, 16 GB' },
    { value: 'c5.large', label: 'c5.large — 2 vCPU, 4 GB' },
    { value: 'c5.xlarge', label: 'c5.xlarge — 4 vCPU, 8 GB' },
  ]

  const osImageOptions = [
    { value: 'amazon-linux-2', label: 'Amazon Linux 2' },
    { value: 'amazon-linux-2023', label: 'Amazon Linux 2023' },
    { value: 'ubuntu-22.04', label: 'Ubuntu 22.04 LTS' },
    { value: 'ubuntu-20.04', label: 'Ubuntu 20.04 LTS' },
    { value: 'windows-2022', label: 'Windows Server 2022' },
    { value: 'rhel-9', label: 'Red Hat Enterprise Linux 9' },
  ]

  const runtimeOptions = [
    { value: 'nodejs18.x', label: 'Node.js 18.x' },
    { value: 'nodejs20.x', label: 'Node.js 20.x' },
    { value: 'python3.11', label: 'Python 3.11' },
    { value: 'python3.12', label: 'Python 3.12' },
    { value: 'java17', label: 'Java 17 (Corretto)' },
    { value: 'java21', label: 'Java 21 (Corretto)' },
    { value: 'dotnet8', label: '.NET 8' },
    { value: 'go1.x', label: 'Go 1.x' },
  ]

  const memoryOptions = [
    { value: 128, label: '128 MB' },
    { value: 256, label: '256 MB' },
    { value: 512, label: '512 MB' },
    { value: 1024, label: '1024 MB' },
    { value: 2048, label: '2048 MB' },
    { value: 3072, label: '3072 MB' },
  ]

  const serviceTypeOptions = [
    { value: 'rds', label: 'RDS (Database)' },
    { value: 's3', label: 'S3 (Storage)' },
    { value: 'elasticache', label: 'ElastiCache' },
    { value: 'sqs', label: 'SQS (Queue)' },
    { value: 'sns', label: 'SNS (Notification)' },
  ]

  const instanceClassOptions = [
    { value: 'db.t3.micro', label: 'db.t3.micro — 2 vCPU, 1 GB' },
    { value: 'db.t3.small', label: 'db.t3.small — 2 vCPU, 2 GB' },
    { value: 'db.t3.medium', label: 'db.t3.medium — 2 vCPU, 4 GB' },
    { value: 'db.r5.large', label: 'db.r5.large — 2 vCPU, 16 GB' },
    { value: 'db.r5.xlarge', label: 'db.r5.xlarge — 4 vCPU, 32 GB' },
  ]

  // ── Load Projects ─────────────────────────────────────────────────
  useEffect(() => {
    if (preSelectedProject) {
      setIsLoadingProjects(false)
      return
    }
    const loadProjects = async () => {
      setIsLoadingProjects(true)
      try {
        const response = await fetchProjects()
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
  }, [preSelectedProject])

  // Fetch existing networks for the current project (for servers form "depends_on")
  useEffect(() => {
    if (!preSelectedProjectId || selectedOption !== 'servers') return
    const fetchNetworks = async () => {
      setIsLoadingNetworks(true)
      try {
        const resources = await getResourcesByProject(preSelectedProjectId, { type: 'network' })
        setNetworkOptions(resources || [])
      } catch (err) {
        console.error('Failed to fetch networks:', err)
        setNetworkOptions([])
      } finally {
        setIsLoadingNetworks(false)
      }
    }
    fetchNetworks()
  }, [preSelectedProjectId, selectedOption])

  // ── Form Handlers ─────────────────────────────────────────────────
  const handleNetworkFormChange = (e) => {
    const { name, value, type, checked } = e.target
    if (type === 'checkbox') {
      setNetworkFormData((prev) => ({ ...prev, [name]: checked }))
    } else if (type === 'number') {
      setNetworkFormData((prev) => {
        const newData = { ...prev, [name]: parseInt(value) || 0 }
        if (name === 'availabilityZones' && prev.natGateway === 'yes') {
          newData.natGatewayAzCount = Math.min(newData.natGatewayAzCount, newData.availabilityZones)
        }
        if (name === 'natGatewayAzCount') {
          newData.natGatewayAzCount = Math.min(parseInt(value) || 1, prev.availabilityZones)
        }
        return newData
      })
    } else {
      setNetworkFormData((prev) => {
        const newData = { ...prev, [name]: value }
        if (name === 'natGateway' && value === 'no') newData.natGatewayAzCount = 1
        if (name === 'natGateway' && value === 'yes') {
          newData.natGatewayAzCount = Math.min(prev.natGatewayAzCount, prev.availabilityZones) || 1
        }
        return newData
      })
    }
  }

  const handleServersFormChange = (e) => {
    const { name, value, type } = e.target
    setServersFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }))
  }

  const handleServerlessFormChange = (e) => {
    const { name, value, type } = e.target
    setServerlessFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }))
  }

  const handleCloudManagedFormChange = (e) => {
    const { name, value, type } = e.target
    setCloudManagedFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }))
  }

  // ── Submit Handlers ───────────────────────────────────────────────
  const handleNetworkSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
      const payload = {
        project_id: preSelectedProjectId || '',
        project_name: networkFormData.projectName,
        vpc_name: networkFormData.vpcName,
        vpc_cidr: networkFormData.vpcCidr,
        nat_gateway: networkFormData.natGateway,
        count_of_public_subnets: networkFormData.publicSubnetCount,
        count_of_private_subnets: networkFormData.privateSubnetCount,
        availability_zones_count: networkFormData.availabilityZones,
        nat_gateway_az_count: networkFormData.natGateway === 'yes' ? networkFormData.natGatewayAzCount : 0,
        enable_dns_hostnames: networkFormData.enableDnsHostnames,
        enable_dns_support: networkFormData.enableDnsSupport,
        provider: preSelectedProjectData?.cloud_provider?.toLowerCase() || 'aws',
        region: preSelectedProjectData?.region || 'us-east-1',
        env: preSelectedProjectData?.environment?.toLowerCase() || 'dev',
      }
      const response = await createNetworkInfrastructure(payload)
      onInfrastructureCreated({
        ...payload,
        response,
      })
    } catch (err) {
      setError(err.message || 'Failed to create network infrastructure')
      setIsSubmitting(false)
    }
  }

  const handleGenericSubmit = (getFormData, type) => async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
      const formData = getFormData()
      // Inject project_id and project metadata
      const enrichedFormData = {
        ...formData,
        project_id: preSelectedProjectId || '',
        provider: preSelectedProjectData?.cloud_provider?.toLowerCase() || 'aws',
        region: preSelectedProjectData?.region || 'us-east-1',
        env: preSelectedProjectData?.environment?.toLowerCase() || 'dev',
      }

      // For servers: add network dependency via depends_on
      if (type === 'servers' && formData.networkId) {
        enrichedFormData.depends_on = [formData.networkId]
      }
      let response;
      if (type === 'servers') {
        response = await createServersInfrastructure(enrichedFormData)
      } else if (type === 'serverless') {
        response = await createServerlessInfrastructure(enrichedFormData)
      } else if (type === 'cloud-managed') {
        response = await createCloudManagedInfrastructure(enrichedFormData)
      } else {
        throw new Error(`Unknown infrastructure type: ${type}`)
      }
      
      onInfrastructureCreated({
        ...enrichedFormData,
        type,
        response,
      }, response.message || `${type.charAt(0).toUpperCase() + type.slice(1)} infrastructure created successfully!`)
    } catch (err) {
      setError(err.message || `Failed to create ${type} infrastructure`)
      setIsSubmitting(false)
    }
  }

  // Reusable UI components have been extracted above

  // ═══════════════════════════════════════════════════════════════════
  // NETWORK FORM
  // ═══════════════════════════════════════════════════════════════════
  if (selectedOption === 'network') {
    return (
      <FormCard
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        }
        iconGradient="from-blue-500 to-cyan-500"
        title="Create Network"
        subtitle="Configure VPC, subnets, and gateways"
      >
        <form onSubmit={handleNetworkSubmit} className="space-y-5">
          <ProjectField 
            preSelectedProject={preSelectedProject}
            isLoadingProjects={isLoadingProjects}
            projects={projects}
            value={networkFormData.projectName}
            onChange={handleNetworkFormChange}
          />

          {/* VPC Name + VPC CIDR — 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="vpcName" className={labelClass}>
                VPC Name <span className="text-red-500 font-normal">*</span>
              </label>
              <input
                type="text"
                id="vpcName"
                name="vpcName"
                value={networkFormData.vpcName}
                onChange={handleNetworkFormChange}
                className={inputClass}
                placeholder="my-main-vpc"
                required
              />
            </div>
            <div>
              <label htmlFor="vpcCidr" className={labelClass}>
                VPC CIDR <span className="text-red-500 font-normal">*</span>
              </label>
              <select
                id="vpcCidr"
                name="vpcCidr"
                value={networkFormData.vpcCidr}
                onChange={handleNetworkFormChange}
                className={selectClass}
                required
              >
                <option value="">Select VPC CIDR</option>
                {cidrOptions.map((cidr) => (
                  <option key={cidr} value={cidr}>{cidr}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Public + Private Subnets — 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="publicSubnetCount" className={labelClass}>
                Public Subnets <span className="text-red-500 font-normal">*</span>
              </label>
              <input
                type="number"
                id="publicSubnetCount"
                name="publicSubnetCount"
                value={networkFormData.publicSubnetCount}
                onChange={handleNetworkFormChange}
                min="1"
                max="10"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="privateSubnetCount" className={labelClass}>
                Private Subnets <span className="text-red-500 font-normal">*</span>
              </label>
              <input
                type="number"
                id="privateSubnetCount"
                name="privateSubnetCount"
                value={networkFormData.privateSubnetCount}
                onChange={handleNetworkFormChange}
                min="1"
                max="10"
                className={inputClass}
                required
              />
            </div>
          </div>

          {/* Availability Zones + NAT Gateway — 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="availabilityZones" className={labelClass}>
                Availability Zones <span className="text-red-500 font-normal">*</span>
              </label>
              <input
                type="number"
                id="availabilityZones"
                name="availabilityZones"
                value={networkFormData.availabilityZones}
                onChange={handleNetworkFormChange}
                min="1"
                max="6"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>NAT Gateway</label>
              <PillToggle
                name="natGateway"
                value={networkFormData.natGateway}
                onChange={handleNetworkFormChange}
                options={[
                  { value: 'no', label: 'No' },
                  { value: 'yes', label: 'Yes' },
                ]}
              />
            </div>
          </div>

          {/* NAT Gateway AZ Count — conditional */}
          {networkFormData.natGateway === 'yes' && (
            <div>
              <label htmlFor="natGatewayAzCount" className={labelClass}>
                NAT Gateway AZ Count <span className="text-red-500 font-normal">*</span>
              </label>
              <input
                type="number"
                id="natGatewayAzCount"
                name="natGatewayAzCount"
                value={networkFormData.natGatewayAzCount}
                onChange={handleNetworkFormChange}
                min="1"
                max={networkFormData.availabilityZones}
                className={inputClass}
                required
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Max: {networkFormData.availabilityZones} (based on Availability Zones)
              </p>
            </div>
          )}

          {/* DNS Toggles */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">DNS Settings</p>
            <ToggleSwitch
              name="enableDnsHostnames"
              checked={networkFormData.enableDnsHostnames}
              onChange={handleNetworkFormChange}
              label="Enable DNS Hostnames"
            />
            <ToggleSwitch
              name="enableDnsSupport"
              checked={networkFormData.enableDnsSupport}
              onChange={handleNetworkFormChange}
              label="Enable DNS Support"
            />
          </div>

          <ErrorAlert error={error} />
          <SubmitButton label="Create Network" submittingLabel="Creating Network..." isSubmitting={isSubmitting} onCancel={onCancel} />
        </form>
      </FormCard>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // SERVERS FORM
  // ═══════════════════════════════════════════════════════════════════
  if (selectedOption === 'servers') {
    return (
      <FormCard
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
        }
        iconGradient="from-slate-700 to-slate-900"
        title="Create Servers"
        subtitle="Configure EC2 instances and compute resources"
      >
        <form onSubmit={handleGenericSubmit(() => serversFormData, 'servers')} className="space-y-5">
          <ProjectField 
            preSelectedProject={preSelectedProject}
            isLoadingProjects={isLoadingProjects}
            projects={projects}
            value={serversFormData.projectName}
            onChange={handleServersFormChange}
          />

          {/* Select Network */}
          <div>
            <label htmlFor="networkId" className={labelClass}>
              Network (VPC) <span className="text-red-500 font-normal">*</span>
            </label>
            {isLoadingNetworks ? (
              <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400 border border-slate-200 rounded-xl bg-slate-50">
                <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                Loading networks...
              </div>
            ) : networkOptions.length === 0 ? (
              <div className="px-4 py-2.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="font-medium">No networks found.</span> Create a Network (VPC) first before provisioning servers.
              </div>
            ) : (
              <select
                id="networkId"
                name="networkId"
                value={serversFormData.networkId}
                onChange={handleServersFormChange}
                className={selectClass}
                required
              >
                <option value="">Select a network...</option>
                {networkOptions.map((net) => (
                  <option key={net.id} value={net.id}>
                    {net.name}{net.config?.vpc_cidr ? ` (${net.config.vpc_cidr})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Instance Type + OS Image — 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="instanceType" className={labelClass}>
                Instance Type <span className="text-red-500 font-normal">*</span>
              </label>
              <select
                id="instanceType"
                name="instanceType"
                value={serversFormData.instanceType}
                onChange={handleServersFormChange}
                className={selectClass}
                required
              >
                {instanceTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="osImage" className={labelClass}>
                OS Image <span className="text-red-500 font-normal">*</span>
              </label>
              <select
                id="osImage"
                name="osImage"
                value={serversFormData.osImage}
                onChange={handleServersFormChange}
                className={selectClass}
                required
              >
                {osImageOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Instance Count + Storage — 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="instanceCount" className={labelClass}>
                Instance Count <span className="text-red-500 font-normal">*</span>
              </label>
              <input
                type="number"
                id="instanceCount"
                name="instanceCount"
                value={serversFormData.instanceCount}
                onChange={handleServersFormChange}
                min="1"
                max="20"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="storageSize" className={labelClass}>
                Storage (GB) <span className="text-red-500 font-normal">*</span>
              </label>
              <input
                type="number"
                id="storageSize"
                name="storageSize"
                value={serversFormData.storageSize}
                onChange={handleServersFormChange}
                min="8"
                max="1000"
                className={inputClass}
                required
              />
            </div>
          </div>

          {/* Key Pair Name */}
          <div>
            <label htmlFor="keyPairName" className={labelClass}>
              Key Pair Name <span className="text-slate-400 text-xs font-normal">(optional)</span>
            </label>
            <input
              type="text"
              id="keyPairName"
              name="keyPairName"
              value={serversFormData.keyPairName}
              onChange={handleServersFormChange}
              className={inputClass}
              placeholder="my-key-pair"
            />
          </div>

          <ErrorAlert error={error} />
          <SubmitButton label="Create Servers" submittingLabel="Creating Servers..." isSubmitting={isSubmitting} onCancel={onCancel} />
        </form>
      </FormCard>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // SERVERLESS FORM
  // ═══════════════════════════════════════════════════════════════════
  if (selectedOption === 'serverless') {
    return (
      <FormCard
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
        }
        iconGradient="from-emerald-500 to-teal-500"
        title="Create Serverless"
        subtitle="Configure Lambda functions and event-driven resources"
      >
        <form onSubmit={handleGenericSubmit(() => serverlessFormData, 'serverless')} className="space-y-5">
          <ProjectField 
            preSelectedProject={preSelectedProject}
            isLoadingProjects={isLoadingProjects}
            projects={projects}
            value={serverlessFormData.projectName}
            onChange={handleServerlessFormChange}
          />

          {/* Runtime + Memory — 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="runtime" className={labelClass}>
                Runtime <span className="text-red-500 font-normal">*</span>
              </label>
              <select
                id="runtime"
                name="runtime"
                value={serverlessFormData.runtime}
                onChange={handleServerlessFormChange}
                className={selectClass}
                required
              >
                {runtimeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="memorySize" className={labelClass}>
                Memory <span className="text-red-500 font-normal">*</span>
              </label>
              <select
                id="memorySize"
                name="memorySize"
                value={serverlessFormData.memorySize}
                onChange={handleServerlessFormChange}
                className={selectClass}
                required
              >
                {memoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Timeout + Handler — 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="timeout" className={labelClass}>
                Timeout (seconds) <span className="text-red-500 font-normal">*</span>
              </label>
              <input
                type="number"
                id="timeout"
                name="timeout"
                value={serverlessFormData.timeout}
                onChange={handleServerlessFormChange}
                min="1"
                max="900"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="handler" className={labelClass}>
                Handler <span className="text-red-500 font-normal">*</span>
              </label>
              <input
                type="text"
                id="handler"
                name="handler"
                value={serverlessFormData.handler}
                onChange={handleServerlessFormChange}
                className={inputClass}
                placeholder="index.handler"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className={labelClass}>
              Description <span className="text-slate-400 text-xs font-normal">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={serverlessFormData.description}
              onChange={handleServerlessFormChange}
              rows="3"
              className={`${inputClass} resize-none`}
              placeholder="Brief description of this function"
            />
          </div>

          <ErrorAlert error={error} />
          <SubmitButton label="Create Serverless" submittingLabel="Creating Serverless..." isSubmitting={isSubmitting} onCancel={onCancel} />
        </form>
      </FormCard>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // CLOUD MANAGED FORM
  // ═══════════════════════════════════════════════════════════════════
  if (selectedOption === 'cloud-managed') {
    return (
      <FormCard
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        }
        iconGradient="from-orange-500 to-amber-500"
        title="Cloud Managed Service"
        subtitle="Configure RDS, S3, ElastiCache, and other managed services"
      >
        <form onSubmit={handleGenericSubmit(() => cloudManagedFormData, 'cloud-managed')} className="space-y-5">
          <ProjectField 
            preSelectedProject={preSelectedProject}
            isLoadingProjects={isLoadingProjects}
            projects={projects}
            value={cloudManagedFormData.projectName}
            onChange={handleCloudManagedFormChange}
          />

          {/* Service Type + Service Name — 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="serviceType" className={labelClass}>
                Service Type <span className="text-red-500 font-normal">*</span>
              </label>
              <select
                id="serviceType"
                name="serviceType"
                value={cloudManagedFormData.serviceType}
                onChange={handleCloudManagedFormChange}
                className={selectClass}
                required
              >
                {serviceTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="serviceName" className={labelClass}>
                Service Name <span className="text-red-500 font-normal">*</span>
              </label>
              <input
                type="text"
                id="serviceName"
                name="serviceName"
                value={cloudManagedFormData.serviceName}
                onChange={handleCloudManagedFormChange}
                className={inputClass}
                placeholder="my-database"
                required
              />
            </div>
          </div>

          {/* Instance Class + Storage — 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="instanceClass" className={labelClass}>
                Instance Class <span className="text-red-500 font-normal">*</span>
              </label>
              <select
                id="instanceClass"
                name="instanceClass"
                value={cloudManagedFormData.instanceClass}
                onChange={handleCloudManagedFormChange}
                className={selectClass}
                required
              >
                {instanceClassOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cmStorageSize" className={labelClass}>
                Storage (GB) <span className="text-red-500 font-normal">*</span>
              </label>
              <input
                type="number"
                id="cmStorageSize"
                name="storageSize"
                value={cloudManagedFormData.storageSize}
                onChange={handleCloudManagedFormChange}
                min="5"
                max="5000"
                className={inputClass}
                required
              />
            </div>
          </div>

          <ErrorAlert error={error} />
          <SubmitButton label="Create Managed Service" submittingLabel="Creating Service..." isSubmitting={isSubmitting} onCancel={onCancel} />
        </form>
      </FormCard>
    )
  }

  return null
}

export default InfrastructureCreate
