import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import PageLayout from '../components/PageLayout'

const MonitoringPage = () => {
  const { userInfo, handleLogout } = useAuth()

  useEffect(() => {
    document.title = 'infraXai - Monitoring'
  }, [])

  return (
    <PageLayout userInfo={userInfo} onLogout={handleLogout}>
      <main className="flex-1 overflow-y-auto p-6 bg-slate-50/50 backdrop-blur-3xl w-full">
          <div className="max-w-7xl mx-auto">
            {/* Under Development Message */}
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] border border-white/60 p-12 max-w-md">
                <div className="mb-6">
                  <svg 
                    className="w-28 h-28 mx-auto text-blue-500 animate-pulse drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
                    />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-slate-800 mb-4 font-display">
                  Monitoring
                </h1>
                <p className="text-lg text-slate-600 mb-2">
                  This page is currently
                </p>
                <p className="text-2xl font-semibold text-[#30705d]">
                  Under Development
                </p>
                <p className="text-sm text-slate-500 mt-6">
                  We're working hard to bring you amazing monitoring features. Stay tuned!
                </p>
              </div>
            </div>
          </div>
      </main>
    </PageLayout>
  )
}

export default MonitoringPage

