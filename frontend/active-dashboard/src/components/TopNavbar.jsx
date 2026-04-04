import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'

const TopNavbar = ({ userInfo, onLogout, onMenuToggle, isMenuOpen }) => {
  const location = useLocation()

  return (
    <div className="absolute top-0 right-0 left-0 z-40 pointer-events-none w-full">
      <div className="flex justify-between items-start px-4 sm:px-6 py-4 sm:py-6 relative w-full h-full">
        {/* Left side - Hamburger Menu (Mobile Only) */}
        <div className="pointer-events-auto">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2.5 rounded-xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] text-slate-600 hover:bg-[#F0F7FF] hover:text-[#2196F3] transition-all duration-300 group"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6 transition-transform group-hover:scale-110"
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
        </div>

        {/* Right side - User Info floating island */}
        <div className="pointer-events-auto flex items-center justify-end w-full">
          {userInfo && (
            <div className="flex items-center gap-2 sm:gap-4 bg-white/60 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] p-1.5 sm:p-2 rounded-full transition-all duration-300">
              {/* User Name with Hover Dropdown */}
              <div className="relative group">
                <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/90 rounded-full text-slate-700 font-medium cursor-pointer transition-all duration-300 shadow-sm border border-slate-100 hover:border-blue-200 hover:text-blue-600">
                  <span className="text-xs sm:text-sm font-semibold opacity-80" style={{ letterSpacing: '0.05em' }}>HI,</span>
                  <span className="text-xs sm:text-base truncate max-w-[80px] sm:max-w-none font-bold">
                    {userInfo.username || 'User'}
                  </span>
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:rotate-180 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                
                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-3 w-56 sm:w-64 bg-white/95 backdrop-blur-md rounded-2xl border border-white/80 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform origin-top-right group-hover:scale-100 scale-95 z-50">
                  <div className="p-4 sm:p-5">
                    <div className="border-b border-slate-100 pb-3 mb-3">
                      <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 mt-1">Acct Details</h3>
                    </div>
                    <div className="space-y-3">
                      {userInfo.username && (
                        <div className="flex items-start gap-3">
                          <span className="text-slate-400 text-xs sm:text-sm font-medium min-w-[70px]">User:</span>
                          <span className="text-slate-800 font-semibold text-xs sm:text-sm break-words">{userInfo.username}</span>
                        </div>
                      )}
                      {userInfo.email && (
                        <div className="flex items-start gap-3">
                          <span className="text-slate-400 text-xs sm:text-sm font-medium min-w-[70px]">Email:</span>
                          <span className="text-slate-800 font-semibold text-xs sm:text-sm break-words">{userInfo.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <button
                onClick={onLogout}
                className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm text-slate-600 bg-white/80 hover:bg-red-50 hover:text-red-500 transition-all duration-300 shadow-sm border border-slate-100 hover:border-red-100"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TopNavbar

