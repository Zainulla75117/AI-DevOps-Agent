/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agentic: {
          primary: '#30705d',
          secondary: '#F6F6F1',
          success: '#16A34A',
          warning: '#D97706',
          danger: '#DC2626',
          surface: '#FFFFFF',
          text: '#111827',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        textShine: {
          '0%': {
            'background-position': '0% 50%'
          },
          '100%': {
            'background-position': '200% 50%'
          }
        }
      },
      animation: {
        'text-shine': 'textShine 2.5s linear infinite',
      }
    },
  },
  plugins: [],
}

