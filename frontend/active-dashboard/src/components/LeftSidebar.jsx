import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { 
  LayoutDashboard, 
  Server, 
  Workflow, 
  Activity, 
  Settings, 
  RefreshCw,
  Box
} from 'lucide-react'

// Icon Wrappers to handle isSelected prop easily
const IconWrapper = ({ Icon, className }) => (
  <Icon 
    className={className} 
    strokeWidth={2}
  />
)

const DashboardIcon = (props) => <IconWrapper Icon={LayoutDashboard} {...props} />
const InfrastructureIcon = (props) => <IconWrapper Icon={Server} {...props} />
const AutomationIcon = (props) => <IconWrapper Icon={Workflow} {...props} />
const MonitoringIcon = (props) => <IconWrapper Icon={Activity} {...props} />
const SettingsIcon = (props) => <IconWrapper Icon={Settings} {...props} />
const CICDIcon = (props) => <IconWrapper Icon={RefreshCw} {...props} />

const LeftSidebar = ({ 
  onInfrastructureOptionSelect, 
  onAutomationOptionSelect, 
  showAutomationSubmenu = false, 
  onBackToMainMenu, 
  onAutomationLinkClick,
  selectedAutomationOption = null,
  selectedInfrastructureOption = null,
  isMenuOpen = false,
  onMenuToggle = () => {}
}) => {
  const location = useLocation()
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarExpanded')
    return saved !== null ? saved === 'true' : true
  })
  const [hoveredTooltip, setHoveredTooltip] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const prevPathnameRef = useRef(location.pathname)
  const prevShowAutomationSubmenuRef = useRef(showAutomationSubmenu)
  const isFirstRender = useRef(true)

  useEffect(() => {
    localStorage.setItem('sidebarExpanded', isExpanded)
  }, [isExpanded])
  
  const handleMouseEnter = (e, tooltipId) => {
    if (!isExpanded) {
      const rect = e.currentTarget.getBoundingClientRect()
      setTooltipPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 8
      })
      setHoveredTooltip(tooltipId)
    }
  }
  
  const handleMouseLeave = () => {
    setHoveredTooltip(null)
  }
  
  const getTooltipText = (tooltipId) => {
    if (tooltipId === 'back') return 'Back to Menu'
    if (tooltipId === 'settings') return settingsMenuItem.name
    if (tooltipId?.startsWith('automation-')) {
      const option = automationOptions.find(opt => tooltipId === `automation-${opt.value}`)
      return option?.label || ''
    }
    if (tooltipId?.startsWith('infra-')) {
      const option = infrastructureOptions.find(opt => tooltipId === `infra-${opt.value}`)
      return option?.label || ''
    }
    if (tooltipId?.startsWith('menu-')) {
      const path = tooltipId.replace('menu-', '')
      const item = menuItems.find(item => item.path === path)
      return item?.name || ''
    }
    if (tooltipId?.startsWith('tool-')) {
      const path = tooltipId.replace('tool-', '')
      const item = quickTools.find(item => item.path === path)
      return item?.name || ''
    }
    return ''
  }

  const menuItems = [
    { name: 'Dashboard', path: '/home', icon: DashboardIcon },
    { name: 'Infrastructure', path: '/infrastructure', icon: InfrastructureIcon },
    { name: 'Automation', path: '/automation', icon: AutomationIcon, hasSubmenu: true },
    { name: 'Monitoring', path: '/monitoring', icon: MonitoringIcon },
  ]
  
  // Settings menu item (separated to be at bottom)
  const settingsMenuItem = { name: 'Settings', path: '/settings', icon: SettingsIcon }



  const automationOptions = [
    { value: 'cicd', label: 'CI/CD Automation', icon: CICDIcon },
  ]

  const quickTools = [
    { name: 'Dockerfile', path: '/tools/dockerfile', iconUrl: '/tool_icons/icons8-docker-96.png' },
    { name: 'Jenkins Pipeline', path: '/tools/jenkins', iconUrl: '/tool_icons/icons8-jenkins-480.png' },
    { name: 'K8s Manifest', path: '/tools/k8s-manifest', iconUrl: '/tool_icons/icons8-kubernetes-480.png' },
    { name: 'Helm Charts', path: '/tools/helm', iconUrl: '/tool_icons/Helm.png' },
  ]



  const handleAutomationOptionClick = (option) => {
    if (onAutomationOptionSelect) {
      onAutomationOptionSelect(option)
    }
  }

  // Show automation submenu when on automation page and showAutomationSubmenu is true
  // Only show submenu if showAutomationSubmenu is explicitly true (not just on automation page)
  const showAutomationMenu = location.pathname === '/automation' && showAutomationSubmenu === true

  // Mark first render complete
  useEffect(() => {
    isFirstRender.current = false
  }, [])

  // Track menu state changes (main menu <-> automation submenu)
  useEffect(() => {
    if (isFirstRender.current) return

    // Animate when switching between main menu and automation submenu
    if (prevShowAutomationSubmenuRef.current !== showAutomationSubmenu) {
      setShouldAnimate(true)
      prevShowAutomationSubmenuRef.current = showAutomationSubmenu
      // Reset animation flag after animation completes
      const timer = setTimeout(() => {
        setShouldAnimate(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [showAutomationSubmenu])

  return (
    <>
      {/* Mobile Overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 z-40 lg:hidden"
          onClick={onMenuToggle}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50
        ${isExpanded ? 'w-64' : 'w-16'} bg-white/60 backdrop-blur-2xl border-r border-white/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)]
        transform transition-all duration-300 ease-in-out
        ${isMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        group
      `}>
        {/* Expand/Collapse button - Desktop only */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`hidden lg:flex absolute top-[24px] ${isExpanded ? 'right-3' : '-right-[12px]'} w-6 h-6 items-center justify-center rounded-full bg-white text-slate-500 hover:bg-[#F0F7FF] hover:text-[#2196F3] transition-all duration-300 border border-slate-200 shadow-sm z-50`}
          aria-label={isExpanded ? "Collapse menu" : "Expand menu"}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">

        <div className="p-2 flex-1 flex flex-col overflow-visible">
          <div className="relative flex items-center justify-center mb-4 mt-2 h-10 w-full">
            {/* Branding container */}
            <div className={`flex items-center overflow-hidden w-full transition-all duration-300 ${isExpanded ? 'justify-start px-2 gap-4' : 'justify-center px-0 gap-0'}`}>
              <div className="flex-shrink-0 flex items-center justify-center w-11 h-11">
                <img src="/infraxai_logo.png" alt="infraXai Logo" className="w-full h-full object-contain" />
              </div>
              <span className={`font-bold text-[20px] text-slate-800 whitespace-nowrap hidden lg:block tracking-[0.05em] font-brand transition-all duration-300 overflow-hidden ${isExpanded ? 'max-w-[150px] opacity-100' : 'max-w-0 opacity-0'}`}>
                infraXai
              </span>
            </div>


            {/* Close button for mobile */}
            <button
              onClick={onMenuToggle}
              className="lg:hidden absolute right-2 p-1.5 rounded-md text-slate-500 hover:bg-[#F0F7FF] hover:text-[#2196F3] transition-all duration-300"
              aria-label="Close menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        <nav className="space-y-1 relative flex-1 overflow-visible mt-2">
          {/* Main Navigation Section Title */}
          {!showAutomationMenu && (
            <div className={`px-4 pb-2 pt-1 uppercase tracking-wider text-[11px] font-bold text-slate-400 hidden lg:block transition-all duration-300 overflow-hidden whitespace-nowrap ${isExpanded ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0 px-0'}`}>
              AI Agents
            </div>
          )}
          {showAutomationMenu && (
            <div className={`px-4 pb-2 pt-1 uppercase tracking-wider text-[11px] font-bold text-slate-400 hidden lg:block transition-all duration-300 overflow-hidden whitespace-nowrap ${isExpanded ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0 px-0'}`}>
              Automation Hub
            </div>
          )}
          {showAutomationMenu ? (
            <div 
              key="automation-menu"
              style={{
                animation: shouldAnimate ? 'slide-in-left 0.3s ease-out' : 'none'
              }}
            >
              {/* Back Button */}
              <button
                onClick={() => {
                  onBackToMainMenu()
                  // Close mobile menu when going back
                  if (isMenuOpen) {
                    onMenuToggle()
                  }
                }}
                onMouseEnter={(e) => handleMouseEnter(e, 'back')}
                onMouseLeave={handleMouseLeave}
                className={`relative w-full flex items-center p-3 rounded-md font-medium transition-all duration-300 overflow-hidden ${isExpanded ? 'justify-start px-4' : 'justify-start px-[14px]'} text-slate-700 hover:bg-[#F0F7FF] hover:text-[#2196F3] mb-4`}
                style={{
                  animation: shouldAnimate ? 'menu-item-fade 0.3s ease-out 0.1s both' : 'none'
                }}
                title={!isExpanded ? "Back to Menu" : ""}
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span className={`text-sm whitespace-nowrap transition-all duration-300 overflow-hidden ${isExpanded ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0'}`}>
                  Back to Menu
                </span>
              </button>
              {/* Automation Options */}
              {automationOptions.map((option, index) => {
                const isSelected = selectedAutomationOption === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      handleAutomationOptionClick(option.value)
                      // Close mobile menu when option is selected
                      if (isMenuOpen) {
                        onMenuToggle()
                      }
                    }}
                    onMouseEnter={(e) => handleMouseEnter(e, `automation-${option.value}`)}
                    onMouseLeave={handleMouseLeave}
                    className={`relative w-full flex items-center p-3 rounded-md font-medium transition-all duration-300 overflow-hidden ${isExpanded ? 'justify-start px-4' : 'justify-start px-[14px]'} ${
                      isSelected
                        ? 'bg-[#E3F2FD] text-slate-900 font-semibold'
                        : 'text-slate-700 hover:bg-[#F0F7FF] hover:text-[#2196F3]'
                    }`}
                    style={{
                      animation: shouldAnimate ? `menu-item-fade 0.3s ease-out ${0.15 + index * 0.1}s both` : 'none'
                    }}
                    title={!isExpanded ? option.label : ""}
                  >
                    {typeof option.icon === 'function' ? (
                      <option.icon className="w-5 h-5 flex-shrink-0" isSelected={isSelected} />
                    ) : (
                      <span className="text-xl flex-shrink-0">{option.icon}</span>
                    )}
                    <span className={`text-sm whitespace-nowrap transition-all duration-300 overflow-hidden ${isExpanded ? 'max-w-[200px] opacity-100 ml-3' : 'max-w-0 opacity-0 ml-0'}`}>
                      {option.label}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div
              key="main-menu"
              style={{
                animation: shouldAnimate ? 'slide-in-left 0.3s ease-out' : 'none'
              }}
            >
              {menuItems.map((item, index) => (
                <div 
                  key={item.path} 
                  className="relative overflow-visible"
                >
                  <Link
                    to={item.path}
                    onClick={() => {
                      // Reset automation state when Automation link is clicked
                      if (item.path === '/automation' && onAutomationLinkClick) {
                        onAutomationLinkClick()
                      }
                      // Close mobile menu when link is clicked
                      if (isMenuOpen) {
                        onMenuToggle()
                      }
                    }}
                    onMouseEnter={(e) => handleMouseEnter(e, `menu-${item.path}`)}
                    onMouseLeave={handleMouseLeave}
                    className={`relative w-full flex items-center p-3 rounded-md font-medium transition-all duration-300 overflow-hidden ${isExpanded ? 'justify-start px-4' : 'justify-start px-[14px]'} ${
                      location.pathname === item.path
                        ? 'bg-[#E3F2FD] text-slate-900 font-semibold'
                        : 'text-slate-700 hover:bg-[#F0F7FF] hover:text-[#2196F3]'
                    }`}
                    title={!isExpanded ? item.name : ""}
                  >
                    {typeof item.icon === 'function' ? (
                      <item.icon className="w-5 h-5 flex-shrink-0" isSelected={location.pathname === item.path} />
                    ) : (
                      <span className="text-xl flex-shrink-0">{item.icon}</span>
                    )}
                    <span className={`text-sm whitespace-nowrap transition-all duration-300 overflow-hidden ${isExpanded ? 'max-w-[200px] opacity-100 ml-3' : 'max-w-0 opacity-0 ml-0'}`}>
                      {item.name}
                    </span>
                  </Link>
                </div>
              ))}

              {/* Quick Tools Section Title */}
              <div className="mt-2 mb-2 border-t border-slate-200/60 mx-1" />
              <div className={`px-4 pb-2 pt-1 uppercase tracking-wider text-[11px] font-bold text-slate-400 hidden lg:block transition-all duration-300 overflow-hidden whitespace-nowrap ${isExpanded ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0 px-0'}`}>
                Quick Tools
              </div>
              {/* Quick Tools Items */}
              {quickTools.map((item, index) => (
                <div 
                  key={item.path} 
                  className="relative overflow-visible"
                >
                  <Link
                    to={item.path}
                    onClick={() => {
                      if (isMenuOpen) {
                        onMenuToggle()
                      }
                    }}
                    onMouseEnter={(e) => handleMouseEnter(e, `tool-${item.path}`)}
                    onMouseLeave={handleMouseLeave}
                    className={`relative w-full flex items-center p-3 rounded-md font-medium transition-all duration-300 overflow-hidden ${isExpanded ? 'justify-start px-4' : 'justify-start px-[14px]'} ${
                      location.pathname === item.path
                        ? 'bg-[#E3F2FD] text-slate-900 font-semibold'
                        : 'text-slate-700 hover:bg-[#F0F7FF] hover:text-[#2196F3]'
                    }`}
                    title={!isExpanded ? item.name : ""}
                  >
                    <img src={item.iconUrl} alt={item.name} className={`w-5 h-5 flex-shrink-0 object-contain transition-all duration-200 ${location.pathname === item.path ? 'opacity-100' : 'opacity-75 group-hover:opacity-100'}`} />
                    <span className={`text-sm whitespace-nowrap transition-all duration-300 overflow-hidden ${isExpanded ? 'max-w-[200px] opacity-100 ml-3' : 'max-w-0 opacity-0 ml-0'}`}>
                      {item.name}
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </nav>
        </div>
        
        {/* Settings at bottom */}
        {!showAutomationMenu && (
          <div className="p-2 border-t border-slate-200 mt-auto">
            {/* System Section Title */}
            <div className={`px-2 pb-2 pt-2 uppercase tracking-wider text-[11px] font-bold text-slate-400 hidden lg:block mt-1 transition-all duration-300 overflow-hidden whitespace-nowrap ${isExpanded ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0 px-0'}`}>
              System
            </div>
            <Link
              to={settingsMenuItem.path}
              onClick={() => {
                // Close mobile menu when link is clicked
                if (isMenuOpen) {
                  onMenuToggle()
                }
              }}
              onMouseEnter={(e) => handleMouseEnter(e, 'settings')}
              onMouseLeave={handleMouseLeave}
              className={`relative w-full flex items-center p-3 rounded-md font-medium transition-all duration-300 overflow-hidden ${isExpanded ? 'justify-start px-4' : 'justify-start px-[14px]'} ${
                location.pathname === settingsMenuItem.path
                  ? 'bg-[#E3F2FD] text-slate-900 font-semibold'
                  : 'text-slate-700 hover:bg-[#F0F7FF] hover:text-[#2196F3]'
              }`}
              title={!isExpanded ? settingsMenuItem.name : ""}
            >
              {typeof settingsMenuItem.icon === 'function' ? (
                <settingsMenuItem.icon className="w-5 h-5 flex-shrink-0" isSelected={location.pathname === settingsMenuItem.path} />
              ) : (
                <span className="text-xl flex-shrink-0">{settingsMenuItem.icon}</span>
              )}
              <span className={`text-sm whitespace-nowrap transition-all duration-300 overflow-hidden ${isExpanded ? 'max-w-[200px] opacity-100 ml-3' : 'max-w-0 opacity-0 ml-0'}`}>
                {settingsMenuItem.name}
              </span>
            </Link>
          </div>
        )}
      </div>
    </aside>
    
    {/* Tooltip - Rendered outside sidebar to avoid overflow issues */}
    {!isExpanded && hoveredTooltip && (
      <div
        className="fixed px-3 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg whitespace-nowrap z-[9999] shadow-2xl border border-slate-700/50 pointer-events-none"
        style={{
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`,
          transform: 'translateY(-50%)',
        }}
      >
        <div
          className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800"
          style={{
            position: 'absolute',
            right: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        ></div>
        {getTooltipText(hoveredTooltip)}
      </div>
    )}
    </>
  )
}

export default LeftSidebar

