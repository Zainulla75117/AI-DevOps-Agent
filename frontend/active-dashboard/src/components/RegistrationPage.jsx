import { useState, useEffect } from 'react'
import InfinityLogo from './InfinityLogo'
import RegistrationForm from './RegistrationForm'

const RegistrationPage = () => {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    document.title = 'DevOps Infinity - Register'
  }, [])

  return (
    <div className="w-full min-h-screen flex flex-col-reverse lg:flex-row bg-white relative">
      {/* Brand Logo - Top Left Corner */}
      <div className="fixed top-4 left-4 sm:top-6 sm:left-6 z-50">
        <img 
          src="/My_Brand-Logo_1.png" 
          alt="DevOps Infinity Logo" 
          className="h-6 sm:h-8 w-auto object-contain"
          onError={(e) => {
            e.target.src = '/My_Brand-Logo.png'
          }}
        />
      </div>

      {/* Left Panel - Registration Form (50% on desktop) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-12 py-12 lg:py-0 bg-white relative animate-in fade-in slide-in-from-right-8 duration-700">
        <div className="w-full max-w-md pt-16 lg:pt-0">
          <RegistrationForm isLoading={isLoading} setIsLoading={setIsLoading} />
        </div>
      </div>

      {/* Right Panel - Brand / Visual Section (50% on desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-950 items-center justify-center overflow-hidden shadow-2xl">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 via-transparent to-fuchsia-500/20 mix-blend-overlay"></div>
        
        {/* Abstract geometric shapes */}
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0)_80%)]"></div>
        
        {/* Visual Content Container */}
        <div className="relative z-10 flex flex-col items-center justify-center px-12 max-w-lg w-full">
          {/* Animated Logo */}
          <div className="scale-[1.8] opacity-100 mb-16 transform transition-transform hover:scale-[1.9] duration-500 filter drop-shadow-[0_0_15px_rgba(167,139,250,0.5)]">
            <InfinityLogo />
          </div>

          {/* Onboarding Value Proposition */}
          <div className="text-center space-y-6 bg-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-2xl">
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-100 to-fuchsia-200 tracking-tight">
              Build the Future Faster
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-violet-100">
                <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 border border-violet-400/20">
                  <svg className="w-5 h-5 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </div>
                <p className="text-sm font-medium text-left">Deploy infrastructure in minutes with AI-driven automation.</p>
              </div>
              <div className="flex items-center gap-4 text-violet-100">
                <div className="w-10 h-10 rounded-full bg-fuchsia-500/20 flex items-center justify-center flex-shrink-0 border border-fuchsia-400/20">
                  <svg className="w-5 h-5 text-fuchsia-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                </div>
                <p className="text-sm font-medium text-left">Enterprise-grade security policies applied natively.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Center Vertical Border Divider */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-violet-500/30 to-transparent z-20"></div>
      </div>

      {/* Tablet/Mobile: Show dynamic top banner instead of hidden panel */}
      <div className="flex md:flex lg:hidden w-full h-40 relative bg-gradient-to-r from-indigo-900 via-violet-900 to-fuchsia-900 items-center justify-center overflow-hidden rounded-b-3xl shadow-lg z-10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')]"></div>
        <div className="relative z-10 flex flex-col items-center justify-center mt-6">
          <InfinityLogo />
        </div>
      </div>
    </div>
  )
}

export default RegistrationPage
