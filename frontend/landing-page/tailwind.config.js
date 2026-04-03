/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          green: '#10B981',
          'green-light': '#34D399',
          'green-dark': '#059669',
          blue: '#2196F3',
          'blue-light': '#42A5F5',
          'blue-dark': '#1976D2',
          'blue-bright': '#64B5F6',
        },
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'glow-green': 'glow-green 2s ease-in-out infinite alternate',
        'float': 'float 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(16, 185, 129, 0.5), 0 0 10px rgba(16, 185, 129, 0.3), 0 0 15px rgba(16, 185, 129, 0.2)' },
          '100%': { boxShadow: '0 0 10px rgba(16, 185, 129, 0.6), 0 0 20px rgba(16, 185, 129, 0.4), 0 0 30px rgba(16, 185, 129, 0.3)' },
        },
        'glow-green': {
          '0%': { boxShadow: '0 0 5px rgba(16, 185, 129, 0.5), 0 0 10px rgba(16, 185, 129, 0.3), 0 0 15px rgba(16, 185, 129, 0.2)' },
          '100%': { boxShadow: '0 0 10px rgba(16, 185, 129, 0.6), 0 0 20px rgba(16, 185, 129, 0.4), 0 0 30px rgba(16, 185, 129, 0.3)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) translateZ(0)' },
          '50%': { transform: 'translateY(-20px) translateZ(0)' },
        },
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'smooth-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'smooth-out': 'cubic-bezier(0, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}

