const InfinityLogo = () => {
  return (
    <div className="relative w-40 h-20 sm:w-48 sm:h-24 flex items-center justify-center animate-float" style={{ willChange: 'transform' }}>
      <div 
        className="absolute w-[250px] h-[150px] rounded-full animate-glow-pulse -z-10"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, rgba(139, 92, 246, 0.2) 50%, transparent 70%)',
          willChange: 'opacity'
        }}
      ></div>
      <svg
        className="w-full h-full drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]"
        style={{ willChange: 'transform' }}
        viewBox="0 0 200 100"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: 1 }}
      >
        {/* DevOps Gear Icon - Left */}
        <g className="animate-[spin-slow_8s_linear_infinite]" transform="translate(25, 50)">
          <circle cx="0" cy="0" r="6" fill="url(#gearGradient1)" opacity="0.3" />
          <path
            d="M 0 -7 L 1.5 -7 L 2 -5 L 4 -5 L 4 -3 L 7 -3 L 7 -1 L 4 -1 L 4 1 L 7 1 L 7 3 L 4 3 L 4 5 L 2 5 L 1.5 7 L 0 7 L -1.5 7 L -2 5 L -4 5 L -4 3 L -7 3 L -7 1 L -4 1 L -4 -1 L -7 -1 L -7 -3 L -4 -3 L -4 -5 L -2 -5 L -1.5 -7 Z"
            fill="url(#gearGradient1)"
            opacity="0.85"
          />
          <circle cx="0" cy="0" r="2" fill="#ffffff" opacity="0.9" />
        </g>

        {/* DevOps Gear Icon - Right */}
        <g className="animate-[spin-slow_10s_linear_infinite_reverse]" transform="translate(175, 50)">
          <circle cx="0" cy="0" r="6" fill="url(#gearGradient2)" opacity="0.3" />
          <path
            d="M 0 -7 L 1.5 -7 L 2 -5 L 4 -5 L 4 -3 L 7 -3 L 7 -1 L 4 -1 L 4 1 L 7 1 L 7 3 L 4 3 L 4 5 L 2 5 L 1.5 7 L 0 7 L -1.5 7 L -2 5 L -4 5 L -4 3 L -7 3 L -7 1 L -4 1 L -4 -1 L -7 -1 L -7 -3 L -4 -3 L -4 -5 L -2 -5 L -1.5 -7 Z"
            fill="url(#gearGradient2)"
            opacity="0.85"
          />
          <circle cx="0" cy="0" r="2" fill="#ffffff" opacity="0.9" />
        </g>

        {/* Main Infinity Symbol - DevOps Themed */}
        <path
          className="[stroke-dasharray:300] [stroke-dashoffset:300] animate-[drawPath_2s_ease-in-out_forwards,rotatePath_8s_linear_infinite] origin-center"
          d="M 50 50 
             C 30 30, 10 30, 10 50
             C 10 70, 30 70, 50 50
             C 70 30, 90 30, 90 50
             C 90 70, 70 70, 50 50"
          fill="none"
          stroke="url(#devopsGradient)"
          strokeWidth="3.5"
          opacity="0.9"
        />
        
        {/* Secondary Infinity Symbol (slightly offset) */}
        <path
          className="[stroke-dasharray:300] [stroke-dashoffset:300] animate-[drawPath_2s_ease-in-out_0.5s_forwards,rotatePath_10s_linear_infinite_reverse] origin-center"
          d="M 50 50 
             C 30 30, 10 30, 10 50
             C 10 70, 30 70, 50 50
             C 70 30, 90 30, 90 50
             C 90 70, 70 70, 50 50"
          fill="none"
          stroke="url(#devopsGradient2)"
          strokeWidth="2.5"
          opacity="0.7"
        />

        {/* Gradient Definitions - DevOps Colors */}
        <defs>
          <linearGradient id="devopsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.9" />
            <animate
              attributeName="x1"
              values="0%;100%;0%"
              dur="3s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="y1"
              values="0%;100%;0%"
              dur="3s"
              repeatCount="indefinite"
            />
          </linearGradient>
          <linearGradient id="devopsGradient2" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.7" />
            <animate
              attributeName="x1"
              values="100%;0%;100%"
              dur="3s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="y1"
              values="100%;0%;100%"
              dur="3s"
              repeatCount="indefinite"
            />
          </linearGradient>
          <linearGradient id="gearGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="gearGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Animated Dots - DevOps Colors */}
        <circle className="animate-pulse-dot drop-shadow-[0_0_10px_currentColor] [animation-delay:0s]" cx="10" cy="50" r="3.5" fill="#3b82f6" opacity="0.85" />
        <circle className="animate-pulse-dot drop-shadow-[0_0_10px_currentColor] [animation-delay:0.5s]" cx="50" cy="30" r="3.5" fill="#8b5cf6" opacity="0.8" />
        <circle className="animate-pulse-dot drop-shadow-[0_0_10px_currentColor] [animation-delay:1s]" cx="90" cy="50" r="3.5" fill="#06b6d4" opacity="0.85" />
        <circle className="animate-pulse-dot drop-shadow-[0_0_10px_currentColor] [animation-delay:1.5s]" cx="50" cy="70" r="3.5" fill="#3b82f6" opacity="0.85" />
      </svg>
    </div>
  )
}

export default InfinityLogo

