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
    ? 'bg-[#30705d]' 
    : type === 'error'
    ? 'bg-[#F44336]'
    : 'bg-[#2196F3]'

  return (
    <div className="fixed top-4 left-4 right-4 md:top-24 md:left-auto md:right-6 z-[100] animate-in fade-in slide-in-from-top-4 md:animate-slide-in-right duration-300 flex justify-center">
      <div
        className="flex items-center w-full gap-4 px-4 py-3.5 md:px-5 md:py-4 bg-slate-900/80 md:bg-slate-900 backdrop-blur-2xl md:backdrop-blur-none text-white md:max-w-md rounded-[1.25rem] md:rounded-lg shadow-2xl border border-white/10 md:border-slate-700/50"
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

