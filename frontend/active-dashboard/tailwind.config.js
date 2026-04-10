/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        devops: {
          blue: '#2196F3',
          green: '#30705d',
        },
        theme: {
          blue: '#2196F3',
          green: '#30705d',
          'blue-light': '#F0F7FF',
          'green-light': '#F5FBF5',
          'blue-hover': '#1976D2',
          'green-hover': '#215646',
          'blue-subtle': '#E3F2FD',
          'green-subtle': '#E8F5E9',
        },
      },
      animation: {
        'float': 'float 4s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 4s ease-in-out infinite',
        'slide-in': 'slideIn 0.25s ease-out',
        'fade-in-up': 'fadeInUp 0.25s ease-out 0.05s both',
        'fade-in-right': 'fadeInRight 0.25s ease-out 0.1s both',
        'fade-in-down': 'fadeInDown 0.2s ease-out',
        'draw-path': 'drawPath 2s ease-in-out forwards',
        'rotate-path': 'rotatePath 8s linear infinite',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'input-glow': 'inputGlow 2s ease-in-out infinite',
        'slide-in-error': 'slideInError 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'spin-slow': 'spin 0.6s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) scale(1)' },
          '50%': { transform: 'translateY(-20px) scale(1.05)' },
        },
        pulseGlow: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.5' },
          '50%': { transform: 'scale(1.1)', opacity: '0.8' },
        },
        slideIn: {
          'from': { opacity: '0', transform: 'translateY(30px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInRight: {
          'from': { opacity: '0', transform: 'translateX(30px)' },
          'to': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeInDown: {
          'from': { opacity: '0', transform: 'translateY(-20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        drawPath: {
          'to': { strokeDashoffset: '0' },
        },
        rotatePath: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.5)' },
        },
        glowPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.5' },
          '50%': { transform: 'scale(1.2)', opacity: '0.8' },
        },
        inputGlow: {
          '0%, 100%': { boxShadow: '0 0 0 4px rgba(33, 150, 243, 0.08)' },
          '50%': { boxShadow: '0 0 0 4px rgba(33, 150, 243, 0.15), 0 0 20px rgba(33, 150, 243, 0.2)' },
        },
        slideInError: {
          'from': { opacity: '0', transform: 'translateX(-10px)' },
          'to': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          'from': { opacity: '0', transform: 'translateX(100%)' },
          'to': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}

