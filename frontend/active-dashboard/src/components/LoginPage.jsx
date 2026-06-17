import { useState, useEffect } from 'react'
import InfinityLogo from './InfinityLogo'
import LoginForm from './LoginForm'
import Toast from './Toast'
import ShaderGradient from './ShaderGradient'

const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    document.title = 'infraXai - Login'
  }, [])

  return (
    <div className="w-full min-h-screen flex flex-col lg:flex-row bg-slate-900 md:bg-white relative overflow-hidden md:overflow-visible">
      {/* Mobile Dark Visual Background */}
      <div className="md:hidden absolute inset-0 z-0 pointer-events-none">
        <ShaderGradient />
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
      <div className="md:hidden absolute bottom-8 left-0 right-0 flex justify-center z-0 pointer-events-none">
        <div className="scale-[1.5] opacity-80 pl-4">
          <InfinityLogo />
        </div>
      </div>

      {/* Left Panel - Brand / Visual Section (50% on desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#0B1120] items-center justify-center overflow-hidden">
        <ShaderGradient />

        {/* Infinity Logo centered */}
        <div className="relative z-10 flex items-center justify-center">
          <div className="scale-[2.5] opacity-100">
            <InfinityLogo />
          </div>
        </div>

        {/* Center Border - Gradient Divider */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-700/50 to-transparent z-20"></div>
      </div>

      {/* Right Panel - Login Form (50% on desktop) */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-12 pt-28 pb-32 md:p-0 md:bg-white relative z-10 min-h-screen lg:min-h-0 animate-in fade-in slide-in-from-left-8 duration-500">
        {/* Subtle left border accent on desktop */}
        <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent"></div>

        {/* Mobile Glass Card wrapper */}
        <div className="w-full max-w-lg bg-white/10 md:bg-transparent backdrop-blur-3xl md:backdrop-blur-none p-8 sm:p-10 md:p-0 rounded-[2rem] md:rounded-none shadow-2xl md:shadow-none border border-white/20 md:border-none relative overflow-hidden">

          {/* Subtle mobile card inner shine */}
          <div className="md:hidden absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none"></div>

          <div className="relative z-10 w-full">
            <LoginForm isLoading={isLoading} setIsLoading={setIsLoading} onToast={setToast} />
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

      {/* Toast Notification - Page Level */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

export default LoginPage

