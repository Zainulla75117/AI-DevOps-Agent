import { useEffect } from 'react'

const Toast = ({ message, type = 'success', onClose, duration = 5000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const icon = type === 'success' 
    ? '✓' 
    : type === 'error'
    ? '✕'
    : 'ℹ'

  const iconBg = type === 'success' 
    ? 'bg-[#4CAF50]' 
    : type === 'error'
    ? 'bg-[#F44336]'
    : 'bg-[#2196F3]'

  return (
    <div className="fixed top-24 right-6 z-[100] animate-slide-in-right">
      <div
        className="flex items-center gap-4 px-5 py-4 bg-slate-900 text-white max-w-md rounded-lg shadow-[0_8px_16px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.1)_inset] border border-slate-700/50"
        style={{
          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 2px 4px rgba(0, 0, 0, 0.3) inset'
        }}
      >
        <div className={`flex items-center justify-center w-8 h-8 ${iconBg} rounded-full flex-shrink-0 shadow-lg`}>
          <span className="text-white text-sm font-bold">{icon}</span>
        </div>
        <p className="flex-1 text-sm font-medium text-white">{message}</p>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors duration-150 text-xl leading-none flex-shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-slate-800"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  )
}

export default Toast

