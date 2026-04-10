import { useState, useEffect } from 'react'
import InfinityLogo from './InfinityLogo'
import RegistrationForm from './RegistrationForm'

const RegistrationPage = () => {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    document.title = 'DevOps Infinity - Register'
  }, [])

  return (
    <div className="w-full min-h-screen flex flex-col lg:flex-row bg-slate-900 md:bg-white relative overflow-hidden md:overflow-visible">
      {/* Mobile Dark Visual Background */}
      <div className="md:hidden absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-transparent to-emerald-900/30"></div>
        <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-blue-500/20 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-emerald-500/20 rounded-full blur-[80px]"></div>
      </div>

      {/* Brand Logo - Responsive Placement */}
      <div className="absolute top-8 left-0 right-0 flex justify-center md:fixed md:justify-start md:top-6 md:left-6 z-50">
        <img 
          src="/My_Brand-Logo_1.png" 
          alt="DevOps Infinity Logo" 
          className="h-7 sm:h-8 w-auto object-contain drop-shadow-lg md:drop-shadow-none"
          onError={(e) => {
            e.target.src = '/My_Brand-Logo.png'
          }}
        />
      </div>

      {/* Mobile Animated Logo - Bottom */}
      <div className="md:hidden absolute bottom-8 left-0 right-0 flex justify-center z-0 pointer-events-none">
        <div className="scale-[1.5] opacity-80 pl-4">
          <InfinityLogo />
        </div>
      </div>

      {/* Left Panel - Brand / Visual Section (50% on desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex-col items-center justify-center overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-[#30705d]/20"></div>
        
        {/* Abstract geometric shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#30705d]/10 rounded-full blur-3xl"></div>
        
        {/* Visual Content Container */}
        <div className="relative z-10 flex flex-col items-center justify-center px-12 max-w-lg w-full mt-10">
          {/* Infinity Logo centered */}
          <div className="scale-[2.5] opacity-100 mb-20">
            <InfinityLogo />
          </div>
          
          {/* Onboarding Value Proposition */}
          <div className="text-center space-y-6 bg-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-2xl">
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-blue-300 via-emerald-100 to-blue-200 tracking-tight">
              Build the Future Faster
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-emerald-100/90">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-blue-600/10 flex items-center justify-center flex-shrink-0 border border-blue-400/20 shadow-sm">
                  <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </div>
                <p className="text-sm font-medium text-left">Deploy infrastructure in minutes with AI-driven automation.</p>
              </div>
              <div className="flex items-center gap-4 text-emerald-100/90">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-emerald-600/10 flex items-center justify-center flex-shrink-0 border border-emerald-400/20 shadow-sm">
                  <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                </div>
                <p className="text-sm font-medium text-left">Enterprise-grade security policies applied natively.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Center Border - Gradient Divider */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-700/50 to-transparent z-20"></div>
      </div>

      {/* Right Panel - Registration Form (50% on desktop) */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-12 py-10 pt-20 pb-36 md:pt-0 md:pb-0 md:py-0 md:bg-white relative z-10 min-h-screen lg:min-h-0 animate-in fade-in slide-in-from-right-8 duration-500">
        {/* Subtle left border accent on desktop */}
        <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent"></div>
        
        {/* Mobile Glass Card wrapper */}
        <div className="w-full max-w-md bg-white/95 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none p-6 sm:p-8 md:p-0 rounded-3xl md:rounded-none shadow-2xl md:shadow-none border border-white/20 md:border-none relative overflow-hidden">
          
          {/* Subtle mobile card inner shine */}
          <div className="md:hidden absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none"></div>
          
          <div className="relative z-10 w-full pt-4 md:pt-16 lg:pt-0">
            <RegistrationForm isLoading={isLoading} setIsLoading={setIsLoading} />
          </div>
        </div>
      </div>

      {/* Tablet: Show reduced visual panel */}
      <div className="hidden md:flex lg:hidden w-full h-32 relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-[#30705d]/20"></div>
        <div className="relative z-10 flex items-center justify-center">
          <InfinityLogo />
        </div>
      </div>
    </div>
  )
}

export default RegistrationPage
