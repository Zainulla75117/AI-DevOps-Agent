const Footer = () => {
  return (
    <footer className="bg-white/90 backdrop-blur-lg border-t border-blue-200/50 shadow-sm py-3 sm:py-4">
      <div className="px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
          <div className="text-xs sm:text-sm text-slate-600 text-center sm:text-left">
            © 2024 DevOps Agent Platform. All rights reserved.
          </div>
          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600">
            <span className="text-center sm:text-left">Infrastructure Automation & Management</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer

