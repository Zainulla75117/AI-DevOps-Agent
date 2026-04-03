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
    <div className="w-full min-h-screen flex flex-col lg:flex-row bg-white relative">
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

      {/* Left Panel - Brand / Visual Section (50% on desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 items-center justify-center overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-green-900/20"></div>
        
        {/* Abstract geometric shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-green-500/5 rounded-full blur-3xl"></div>
        
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
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-12 py-12 lg:py-0 bg-white relative">
        {/* Subtle left border accent on desktop */}
        <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent"></div>
        <div className="w-full max-w-md">
          <LoginForm isLoading={isLoading} setIsLoading={setIsLoading} onToast={setToast} />
        </div>
      </div>

      {/* Tablet: Show reduced visual panel */}
      <div className="hidden md:flex lg:hidden w-full h-32 relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-transparent to-green-900/20"></div>
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

