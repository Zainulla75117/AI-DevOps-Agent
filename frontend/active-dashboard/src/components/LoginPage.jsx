import { useState, useEffect } from 'react'
import InfinityLogo from './InfinityLogo'
import LoginForm from './LoginForm'
import Toast from './Toast'

const LoginPage = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    document.title = 'DevOps Infinity - Login'
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
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 items-center justify-center overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-[#30705d]/20"></div>
        
        {/* Abstract geometric shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#30705d]/10 rounded-full blur-3xl"></div>
        
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
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-12 py-10 pt-20 pb-36 md:pt-0 md:pb-0 md:py-0 md:bg-white relative z-10 min-h-screen lg:min-h-0 animate-in fade-in slide-in-from-left-8 duration-500">
        {/* Subtle left border accent on desktop */}
        <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent"></div>
        
        {/* Mobile Glass Card wrapper */}
        <div className="w-full max-w-md bg-white/95 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none p-6 sm:p-8 md:p-0 rounded-3xl md:rounded-none shadow-2xl md:shadow-none border border-white/20 md:border-none relative overflow-hidden">
          
          {/* Subtle mobile card inner shine */}
          <div className="md:hidden absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none"></div>
          
          <div className="relative z-10 w-full">
            <LoginForm isLoading={isLoading} setIsLoading={setIsLoading} onToast={setToast} />
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

