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

        {/* Right side - User Info */}
        <div className="pointer-events-auto flex items-center justify-end w-full px-2 sm:px-4">
          {userInfo && (location.pathname === '/' || location.pathname === '/home') && (
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-slate-400">Hi,</span>
              <span className="text-base sm:text-lg font-bold text-slate-800 font-display tracking-tight">
                {userInfo.username || 'User'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TopNavbar

