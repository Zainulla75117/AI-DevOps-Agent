import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'

const TopNavbar = ({ userInfo, onLogout, onMenuToggle, isMenuOpen }) => {
  const location = useLocation()

  return (
    <nav className="bg-white border-b border-slate-200 z-30">
      <div className="px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Hamburger Menu (Mobile) + Navigation Links */}
          <div className="flex items-center gap-3 sm:gap-6">
            {/* Hamburger Menu Button - Mobile Only */}
            <button
              onClick={onMenuToggle}
              className="lg:hidden p-2 rounded-md text-slate-600 hover:bg-[#F0F7FF] hover:text-[#2196F3] transition-all duration-300"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            
            {/* Navigation Links - Hidden on mobile, visible on desktop */}
            <div className="hidden lg:flex items-center gap-6">
              <Link
                to="/home"
                className={`px-4 py-2 rounded-md font-medium transition-all duration-300 ${
                  location.pathname === '/home'
                    ? 'bg-[#E3F2FD] text-slate-900 font-semibold'
                    : 'text-slate-600 hover:bg-[#F0F7FF] hover:text-[#2196F3]'
                }`}
              >
                Home
              </Link>
              {!userInfo && (
                <Link
                  to="/login"
                  className={`px-4 py-2 rounded-md font-medium transition-all duration-300 ${
                    location.pathname === '/login'
                      ? 'bg-[#F0F7FF] text-[#2196F3] font-semibold'
                      : 'text-slate-600 hover:bg-[#F0F7FF] hover:text-[#2196F3]'
                  }`}
                >
                  Login
                </Link>
              )}
            </div>
          </div>

          {/* Right side - User Info */}
          {userInfo && (
            <div className="flex items-center gap-2 sm:gap-4">
              {/* User Name with Hover Dropdown */}
              <div className="relative group">
                <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-[#F0F7FF] rounded-md text-[#2196F3] font-semibold cursor-pointer transition-all duration-200 hover:bg-[#E3F2FD] hover:shadow-sm">
                  <span className="text-xs sm:text-base">HI,</span>
                  <span className="text-xs sm:text-base truncate max-w-[80px] sm:max-w-none">
                    {userInfo.username || 'User'}
                  </span>
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200 group-hover:rotate-180 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                
                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white rounded-md border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 z-50">
                  <div className="p-4">
                    <div className="border-b border-slate-200 pb-3 mb-3">
                      <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-2">User Details</h3>
                    </div>
                    <div className="space-y-2.5">
                      {userInfo.username && (
                        <div className="flex items-start gap-3">
                          <span className="text-slate-400 text-sm min-w-[80px]">Username:</span>
                          <span className="text-slate-800 font-medium text-sm break-words">{userInfo.username}</span>
                        </div>
                      )}
                      {userInfo.email && (
                        <div className="flex items-start gap-3">
                          <span className="text-slate-400 text-sm min-w-[80px]">Email:</span>
                          <span className="text-slate-800 font-medium text-sm break-words">{userInfo.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <button
                onClick={onLogout}
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-md font-medium text-xs sm:text-base text-slate-800 hover:bg-red-50 hover:text-red-600 transition-all duration-300"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default TopNavbar

