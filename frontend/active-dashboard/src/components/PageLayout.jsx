import { useState } from 'react'
import TopNavbar from './TopNavbar'
import LeftSidebar from './LeftSidebar'
import GlobalAgentWidget from './GlobalAgentWidget'

/**
 * Reusable page layout component
 * Wraps common structure: TopNavbar, LeftSidebar, and the Global Agent Widget
 */
const PageLayout = ({ 
  children, 
  userInfo, 
  onLogout,
  leftSidebarProps = {},
  className = '',
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <div className={`flex flex-col h-screen aurora-bg ${className}`} style={{ willChange: 'scroll-position' }}>
      {/* Top Navbar */}
      <TopNavbar 
        userInfo={userInfo} 
        onLogout={onLogout}
        onMenuToggle={() => setIsMenuOpen(!isMenuOpen)}
        isMenuOpen={isMenuOpen}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <LeftSidebar 
          isMenuOpen={isMenuOpen}
          onMenuToggle={() => setIsMenuOpen(!isMenuOpen)}
          {...leftSidebarProps}
        />

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto relative flex flex-col">
          <div className="pt-2 flex-1 flex flex-col">
            {children}
          </div>
        </div>
      </div>

      {/* Global AI Chat Widget */}
      <GlobalAgentWidget />
    </div>
  )
}

export default PageLayout

