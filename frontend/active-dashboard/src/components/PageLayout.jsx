import { useState } from 'react'
import TopNavbar from './TopNavbar'
import LeftSidebar from './LeftSidebar'
import Footer from './Footer'

/**
 * Reusable page layout component
 * Wraps common structure: TopNavbar, LeftSidebar, Footer
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
        <div className="flex-1 overflow-y-auto relative">
          <div className="pt-2">
            {children}
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}

export default PageLayout

