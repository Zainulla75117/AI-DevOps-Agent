import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'

// Icon Components - Use currentColor to inherit text color (turns white when selected)
// Default colors are complementary to blue-orange gradient background
const DashboardIcon = ({ className, isSelected }) => (
  <svg 
    className={className} 
    fill="none" 
    stroke={isSelected ? "currentColor" : "#8b5cf6"} 
    viewBox="0 0 24 24" 
    strokeWidth={2}
    style={{ color: isSelected ? "#1e293b" : "#8b5cf6" }}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
)

const InfrastructureIcon = ({ className, isSelected }) => (
  <svg 
    className={className} 
    fill="none" 
    stroke={isSelected ? "currentColor" : "#10b981"} 
    viewBox="0 0 24 24" 
    strokeWidth={2}
    style={{ color: isSelected ? "#1e293b" : "#10b981" }}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
)

const AutomationIcon = ({ className, isSelected }) => (
  <svg 
    className={className} 
    fill="none" 
    stroke={isSelected ? "currentColor" : "#8b5cf6"} 
    viewBox="0 0 24 24" 
    strokeWidth={2}
    style={{ color: isSelected ? "#1e293b" : "#8b5cf6" }}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const MonitoringIcon = ({ className, isSelected }) => (
  <svg 
    className={className} 
    fill="none" 
    stroke={isSelected ? "currentColor" : "#06b6d4"} 
    viewBox="0 0 24 24" 
    strokeWidth={2}
    style={{ color: isSelected ? "#1e293b" : "#06b6d4" }}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)

const SettingsIcon = ({ className, isSelected }) => (
  <svg 
    className={className} 
    fill="none" 
    stroke={isSelected ? "currentColor" : "#ec4899"} 
    viewBox="0 0 24 24" 
    strokeWidth={2}
    style={{ color: isSelected ? "#1e293b" : "#ec4899" }}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const NetworkIcon = ({ className, isSelected }) => (
  <svg 
    className={className} 
    fill="none" 
    stroke={isSelected ? "currentColor" : "#06b6d4"} 
    viewBox="0 0 24 24" 
    strokeWidth={2}
    style={{ color: isSelected ? "#1e293b" : "#06b6d4" }}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
  </svg>
)

const ServersIcon = ({ className, isSelected }) => (
  <svg 
    className={className} 
    fill="none" 
    stroke={isSelected ? "currentColor" : "#14b8a6"} 
    viewBox="0 0 24 24" 
    strokeWidth={2}
    style={{ color: isSelected ? "#1e293b" : "#14b8a6" }}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
)

const ServerlessIcon = ({ className, isSelected }) => (
  <svg 
    className={className} 
    fill="none" 
    stroke={isSelected ? "currentColor" : "#8b5cf6"} 
    viewBox="0 0 24 24" 
    strokeWidth={2}
    style={{ color: isSelected ? "#1e293b" : "#8b5cf6" }}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

const CICDIcon = ({ className, isSelected }) => (
  <svg 
    className={className} 
    fill="none" 
    stroke={isSelected ? "currentColor" : "#10b981"} 
    viewBox="0 0 24 24" 
    strokeWidth={2}
    style={{ color: isSelected ? "#1e293b" : "#10b981" }}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

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
  const [showInfraDropdown, setShowInfraDropdown] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [hoveredTooltip, setHoveredTooltip] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const prevPathnameRef = useRef(location.pathname)
  const prevShowAutomationSubmenuRef = useRef(showAutomationSubmenu)
  const isFirstRender = useRef(true)
  
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
    return ''
  }

  const menuItems = [
    { name: 'Dashboard', path: '/home', icon: DashboardIcon },
    { name: 'Infrastructure', path: '/infrastructure', icon: InfrastructureIcon, hasDropdown: true },
    { name: 'Automation', path: '/automation', icon: AutomationIcon, hasSubmenu: true },
    { name: 'Monitoring', path: '/monitoring', icon: MonitoringIcon },
  ]
  
  // Settings menu item (separated to be at bottom)
  const settingsMenuItem = { name: 'Settings', path: '/settings', icon: SettingsIcon }

  const infrastructureOptions = [
    { value: 'network', label: 'Network', icon: NetworkIcon },
    { value: 'servers', label: 'Servers', icon: ServersIcon },
    { value: 'serverless', label: 'Serverless', icon: ServerlessIcon },
  ]

  const automationOptions = [
    { value: 'cicd', label: 'CI/CD Automation', icon: CICDIcon },
  ]

  const handleInfrastructureClick = (e) => {
    e.preventDefault()
    if (location.pathname === '/infrastructure') {
      setShowInfraDropdown(!showInfraDropdown)
    }
  }

  const handleInfrastructureOptionClick = (option) => {
    if (onInfrastructureOptionSelect) {
      onInfrastructureOptionSelect(option)
    }
    setShowInfraDropdown(false)
  }

  const handleAutomationOptionClick = (option) => {
    if (onAutomationOptionSelect) {
      onAutomationOptionSelect(option)
    }
  }

  // Show automation submenu when on automation page and showAutomationSubmenu is true
  // Only show submenu if showAutomationSubmenu is explicitly true (not just on automation page)
  const showAutomationMenu = location.pathname === '/automation' && showAutomationSubmenu === true

  // Track route changes for animations (skip on initial load)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      prevPathnameRef.current = location.pathname
      prevShowAutomationSubmenuRef.current = showAutomationSubmenu
      return
    }

    // Animate if pathname changed (route navigation)
    if (prevPathnameRef.current !== location.pathname) {
      setShouldAnimate(true)
      prevPathnameRef.current = location.pathname
      // Reset animation flag after animation completes
      const timer = setTimeout(() => {
        setShouldAnimate(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [location.pathname])

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
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMenuToggle}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        ${isExpanded ? 'w-64' : 'w-16'} bg-white border-r border-slate-200
        transform transition-all duration-300 ease-in-out
        ${isMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        group
      `}>
      <div className="flex flex-col h-full overflow-y-auto overflow-x-visible">
        <div className="p-2 flex-1 flex flex-col overflow-visible">
          <div className="flex items-center justify-between mb-4">
            {/* Expand/Collapse button - Desktop only */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="hidden lg:flex items-center justify-center p-2 rounded-md text-slate-700 hover:bg-[#F0F7FF] hover:text-[#2196F3] transition-all duration-300 ml-auto"
              aria-label={isExpanded ? "Collapse menu" : "Expand menu"}
            >
              <svg
                className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {/* Close button for mobile */}
            <button
              onClick={onMenuToggle}
              className="lg:hidden p-2 rounded-md text-slate-700 hover:bg-[#F0F7FF] hover:text-[#2196F3] transition-all duration-300"
              aria-label="Close menu"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        <nav className="space-y-1 relative flex-1 overflow-visible">
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
                className={`relative w-full flex items-center ${isExpanded ? 'justify-start gap-3 px-4' : 'justify-center'} p-3 rounded-md font-medium transition-colors duration-200 text-slate-700 hover:bg-[#F0F7FF] hover:text-[#2196F3] mb-4`}
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
                {isExpanded && <span className="text-sm">Back to Menu</span>}
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
                    className={`relative w-full flex items-center ${isExpanded ? 'justify-start gap-3 px-4' : 'justify-center'} p-3 rounded-md font-medium transition-colors duration-200 ${
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
                    {isExpanded && <span className="text-sm">{option.label}</span>}
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
                  {item.hasDropdown && location.pathname === '/infrastructure' ? (
                    <>
                      <button
                        onClick={handleInfrastructureClick}
                        onMouseEnter={(e) => handleMouseEnter(e, `menu-${item.path}`)}
                        onMouseLeave={handleMouseLeave}
                        className={`relative w-full flex items-center ${isExpanded ? 'justify-between gap-3 px-4' : 'justify-center'} p-3 rounded-md font-medium transition-colors duration-200 ${
                          location.pathname === item.path
                            ? 'bg-[#E3F2FD] text-slate-900 font-semibold'
                            : 'text-slate-700 hover:bg-[#F0F7FF] hover:text-[#2196F3]'
                        }`}
                        title={!isExpanded ? item.name : ""}
                      >
                        <div className={`flex items-center ${isExpanded ? 'gap-3' : 'gap-0'}`}>
                          {typeof item.icon === 'function' ? (
                            <item.icon className="w-5 h-5 flex-shrink-0" isSelected={location.pathname === item.path} />
                          ) : (
                            <span className="text-xl flex-shrink-0">{item.icon}</span>
                          )}
                          {isExpanded && <span className="text-sm">{item.name}</span>}
                        </div>
                        {isExpanded && (
                          <svg 
                            className={`w-4 h-4 transition-transform duration-150 flex-shrink-0 ${showInfraDropdown ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </button>
                      
                      {/* Dropdown Menu */}
                      {showInfraDropdown && (
                        <div 
                          className={`mt-1 bg-white rounded-md border border-slate-200 overflow-hidden z-50 ${isExpanded ? 'ml-4' : ''}`}
                        >
                          {infrastructureOptions.map((option) => {
                            const isSelected = selectedInfrastructureOption === option.value
                            return (
                              <button
                                key={option.value}
                                onClick={() => {
                                  handleInfrastructureOptionClick(option.value)
                                  // Close mobile menu when option is selected
                                  if (isMenuOpen) {
                                    onMenuToggle()
                                  }
                                }}
                                onMouseEnter={(e) => handleMouseEnter(e, `infra-${option.value}`)}
                                onMouseLeave={handleMouseLeave}
                                className={`relative w-full flex items-center ${isExpanded ? 'justify-start gap-3 px-4' : 'justify-center'} p-3 font-medium transition-colors duration-200 ${
                                  isSelected
                                    ? 'bg-[#E3F2FD] text-slate-900 font-semibold'
                                    : 'text-slate-700 hover:bg-[#F0F7FF] hover:text-[#2196F3]'
                                }`}
                                title={!isExpanded ? option.label : ""}
                              >
                                {typeof option.icon === 'function' ? (
                                  <option.icon className="w-5 h-5 flex-shrink-0" isSelected={isSelected} />
                                ) : (
                                  <span className="text-lg flex-shrink-0">{option.icon}</span>
                                )}
                                {isExpanded && <span className="text-sm">{option.label}</span>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </>
                  ) : (
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
                      className={`relative w-full flex items-center ${isExpanded ? 'justify-start gap-3 px-4' : 'justify-center'} p-3 rounded-md font-medium transition-colors duration-200 ${
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
                      {isExpanded && <span className="text-sm">{item.name}</span>}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </nav>
        </div>
        
        {/* Settings at bottom */}
        {!showAutomationMenu && (
          <div className="p-2 border-t border-slate-200 mt-auto">
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
              className={`relative w-full flex items-center ${isExpanded ? 'justify-start gap-3 px-4' : 'justify-center'} p-3 rounded-md font-medium transition-colors duration-200 ${
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
              {isExpanded && <span className="text-sm">{settingsMenuItem.name}</span>}
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

