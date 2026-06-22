import { useState, useEffect } from 'react'
import InfinityLogo from './InfinityLogo'
import RegistrationForm from './RegistrationForm'
import ShaderGradient from './ShaderGradient'

const RegistrationPage = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    document.title = 'infraXai - Register'
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <div className="w-full min-h-screen flex flex-col lg:flex-row bg-slate-900 md:bg-white relative overflow-hidden md:overflow-visible">
      {/* Mobile Dark Visual Background */}
      <div className="md:hidden absolute inset-0 z-0 pointer-events-none">
        {!isMobile && <ShaderGradient />}
      </div>

      {/* Brand Logo - Responsive Placement */}
      <div className="absolute top-8 left-0 right-0 flex justify-center md:fixed md:justify-start md:top-6 md:left-6 z-50">
        <img
          src="/My_Brand-Logo_1.png"
          alt="infraXai Logo"
          className="h-7 sm:h-8 w-auto object-contain drop-shadow-lg md:drop-shadow-none"
          onError={(e) => {
            e.target.src = '/My_Brand-Logo.png'
          }}
        />
      </div>

      {/* Mobile Animated Logo - Bottom */}
      {!isMobile && (
        <div className="md:hidden absolute bottom-8 left-0 right-0 flex justify-center z-0 pointer-events-none">
          <div className="scale-[1.5] opacity-80 pl-4">
            <InfinityLogo />
          </div>
        </div>
      )}

      {/* Left Panel - Brand / Visual Section (50% on desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#0B1120] flex-col items-center justify-center overflow-hidden">
        <ShaderGradient />

        {/* Visual Content Container */}
        <div className="relative z-10 flex flex-col items-center justify-center px-12 max-w-lg w-full mt-10">
          {/* Infinity Logo centered */}
          <div className="scale-[2.5] opacity-100 mb-20">
            <InfinityLogo />
          </div>

          {/* Onboarding Value Proposition */}
          <div className="text-center space-y-6">
            <h2 className="text-3xl font-semibold text-white tracking-tight font-display drop-shadow-sm">
              Build the Future Faster
            </h2>
            <div className="space-y-4">
              <div className="text-emerald-50/90 text-center md:text-left">
                <p className="text-sm font-medium leading-relaxed drop-shadow-sm">Deploy infrastructure in minutes with AI-driven automation.</p>
              </div>
              <div className="text-emerald-50/90 text-center md:text-left">
                <p className="text-sm font-medium leading-relaxed drop-shadow-sm">Enterprise-grade security policies applied natively.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Center Border - Gradient Divider */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-700/50 to-transparent z-20"></div>
      </div>

      {/* Right Panel - Registration Form (50% on desktop) */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-12 pt-28 pb-32 md:p-0 md:bg-white relative z-10 min-h-screen lg:min-h-0 animate-in fade-in slide-in-from-right-8 duration-500">
        {/* Subtle left border accent on desktop */}
        <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent"></div>

        {/* Mobile Glass Card wrapper */}
        <div className="w-full max-w-lg bg-slate-900 md:bg-transparent p-8 sm:p-10 md:p-0 rounded-[2rem] md:rounded-none shadow-2xl md:shadow-none border border-slate-800 md:border-none relative overflow-hidden">

          <div className="relative z-10 w-full pt-4 md:pt-16 lg:pt-0">
            <RegistrationForm isLoading={isLoading} setIsLoading={setIsLoading} />
          </div>
        </div>
      </div>

      {/* Tablet: Show reduced visual panel */}
      <div className="hidden md:flex lg:hidden w-full h-32 relative bg-[#0B1120] items-center justify-center overflow-hidden">
        <ShaderGradient />
        <div className="relative z-10 flex items-center justify-center">
          <InfinityLogo />
        </div>
      </div>
    </div>
  )
}

export default RegistrationPage
