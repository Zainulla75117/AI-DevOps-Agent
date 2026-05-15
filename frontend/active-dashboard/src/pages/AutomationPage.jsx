import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import PageLayout from '../components/PageLayout'
import JenkinsChatInterface from '../components/JenkinsChatInterface'

const AutomationPage = () => {
  const location = useLocation()
  const { userInfo, handleLogout } = useAuth()
  const [selectedOption, setSelectedOption] = useState(null) // 'cicd' or null
  const [showSubmenu, setShowSubmenu] = useState(true) // Show submenu by default when on automation page
  const [showJenkinsChat, setShowJenkinsChat] = useState(false) // Track Jenkins chat interface

  useEffect(() => {
    document.title = 'infraXai - Automation'
  }, [])

  // Reset state when navigating to automation page
  useEffect(() => {
    if (location.pathname === '/automation') {
      setSelectedOption(null)
      setShowSubmenu(true) // Always show submenu when landing on automation page
    }
  }, [location.pathname])

  const handleOptionSelect = (option) => {
    setSelectedOption(option)
    // Keep submenu visible when option is selected
  }

  // Handler for sidebar "Back to Menu" button - goes back to main menu
  const handleBackToMainMenu = () => {
    setSelectedOption(null)
    setShowSubmenu(false) // Go back to main menu in sidebar
  }

  // Handler for content "Back to Menu" button - goes back to automation menu view
  const handleBackToAutomationMenu = () => {
    setSelectedOption(null)
    setShowSubmenu(true) // Keep automation submenu visible
  }

  const automationOptions = [
    { value: 'cicd', label: 'CI/CD Automation', icon: '🔄', description: 'Configure Continuous Integration and Continuous Deployment pipelines' },
  ]

  return (
    <PageLayout
      userInfo={userInfo}
      onLogout={handleLogout}
      leftSidebarProps={{
        onAutomationOptionSelect: handleOptionSelect,
        showAutomationSubmenu: showSubmenu,
        onBackToMainMenu: handleBackToMainMenu,
        onAutomationLinkClick: () => {
          setSelectedOption(null)
          setShowSubmenu(true)
        },
        selectedAutomationOption: selectedOption,
      }}
    >
      <main className="flex-1 overflow-y-auto bg-slate-50/50 backdrop-blur-3xl w-full">
        <div className="p-3 sm:p-4">
          {selectedOption ? (
            // Selected Option View
            <div className="max-w-6xl mx-auto">
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] border border-white/60 mb-8 mt-4">
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <button
                    onClick={handleBackToAutomationMenu}
                    className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-md transition-colors duration-150 flex items-center gap-1.5"
                  >
                    <svg
                      className="w-3 h-3 sm:w-4 sm:h-4"
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
                    Back
                  </button>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800">
                    {automationOptions.find(opt => opt.value === selectedOption)?.label || 'Automation'}
                  </h2>
                </div>

                {selectedOption === 'cicd' && (
                  <div className="space-y-3 sm:space-y-4">
                    {/* Kanban Layout */}
                    <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-3">
                      {/* Column 1: Agents */}
                      <div className="flex-shrink-0 w-56 sm:w-72">
                        <div className="bg-slate-50/50 backdrop-blur-sm rounded-2xl p-4 border border-white shadow-sm h-full">
                          <h3 className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">
                            Agents
                          </h3>
                          <div className="space-y-3">
                            {/* Jenkins Agent Block */}
                            <button
                              onClick={() => {
                                console.log('Jenkins Agent clicked, setting showJenkinsChat to true')
                                setShowJenkinsChat(true)
                                console.log('showJenkinsChat state updated')
                              }}
                              className="w-full bg-white/70 backdrop-blur-md rounded-xl p-4 border border-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_-6px_rgba(33,150,243,0.15)] hover:border-blue-200 transition-all duration-300 transform hover:-translate-y-1 text-left cursor-pointer group"
                            >
                              {/* Logo at top */}
                              <div className="flex justify-center mb-2">
                                <img
                                  src="https://upload.wikimedia.org/wikipedia/commons/e/e9/Jenkins_logo.svg"
                                  alt="Jenkins Logo"
                                  className="w-12 h-12 object-contain"
                                  onError={(e) => {
                                    console.error('Failed to load Jenkins logo')
                                    e.target.style.display = 'none'
                                  }}
                                />
                              </div>
                              {/* Info below logo */}
                              <div className="text-center">
                                <h4 className="text-sm font-semibold text-slate-800 mb-1.5">Jenkins Agent</h4>
                                <div className="space-y-1 text-xs text-slate-600">
                                  <p className="flex items-center justify-center gap-1.5 font-medium text-slate-700">
                                    <span className="w-2.5 h-2.5 bg-[#30705d] rounded-full animate-pulse shadow-[0_0_8px_rgba(48,112,93,0.6)]"></span>
                                    Status: Active
                                  </p>
                                  <p>Version: 2.426.1</p>
                                  <p>Last Updated: 2 hours ago</p>
                                </div>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Column 2: Pipelines */}
                      <div className="flex-shrink-0 w-64 sm:w-80">
                        <div className="bg-slate-50/50 backdrop-blur-sm rounded-2xl p-4 border border-white shadow-sm h-full">
                          <h3 className="text-xs sm:text-sm font-semibold text-slate-700 mb-3 sm:mb-4 uppercase tracking-wide">
                            Pipelines
                          </h3>
                          <div className="space-y-2 sm:space-y-3">
                            <div className="bg-white/60 backdrop-blur-md rounded-xl p-4 border border-white border-dashed text-center text-sm font-medium text-slate-400">
                              <p>No pipelines yet</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Column 3: Jobs */}
                      <div className="flex-shrink-0 w-64 sm:w-80">
                        <div className="bg-slate-50/50 backdrop-blur-sm rounded-2xl p-4 border border-white shadow-sm h-full">
                          <h3 className="text-xs sm:text-sm font-semibold text-slate-700 mb-3 sm:mb-4 uppercase tracking-wide">
                            Jobs
                          </h3>
                          <div className="space-y-2 sm:space-y-3">
                            <div className="bg-white/60 backdrop-blur-md rounded-xl p-4 border border-white border-dashed text-center text-sm font-medium text-slate-400">
                              <p>No jobs yet</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Main Menu View
            <div className="max-w-6xl mx-auto">
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 sm:p-10 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] border border-white/60 mt-4">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-3 sm:mb-4">Automation</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {automationOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleOptionSelect(option.value)}
                      className="bg-white/60 backdrop-blur-sm border border-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.03)] rounded-2xl p-6 hover:shadow-[0_8px_30px_-4px_rgba(33,150,243,0.15)] hover:border-blue-200 transition-all duration-300 transform hover:-translate-y-1 text-left group"
                    >
                      <div className="flex items-center gap-4 mb-3">
                        <span className="text-4xl">{option.icon}</span>
                        <h3 className="text-xl font-semibold text-slate-800 group-hover:text-[#1E88E5] transition-colors duration-150">
                          {option.label}
                        </h3>
                      </div>
                      {option.description && (
                        <p className="text-sm text-slate-600">{option.description}</p>
                      )}
                      <div className="mt-4 flex items-center text-[#1E88E5] group-hover:text-[#1976D2]">
                        <span className="text-sm font-medium">Configure</span>
                        <svg
                          className="w-4 h-4 ml-2 transition-transform duration-150 group-hover:translate-x-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Chat Widget Removed - Replaced by GlobalAgentWidget in PageLayout */}

      {/* Jenkins Chat Interface - Full screen ChatGPT-like interface */}
      {showJenkinsChat && (
        <JenkinsChatInterface
          isOpen={showJenkinsChat}
          onClose={() => {
            console.log('Closing Jenkins chat')
            setShowJenkinsChat(false)
          }}
          initialMessage="Hello! I'm your Jenkins Agent. How can I help you with your CI/CD pipelines, builds, or deployments today?"
        />
      )}
    </PageLayout>
  )
}

export default AutomationPage

