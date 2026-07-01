/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agentic: {
          primary: 'rgb(var(--color-agentic-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-agentic-secondary) / <alpha-value>)',
          success: '#16A34A',
          warning: '#D97706',
          danger: '#DC2626',
          surface: 'rgb(var(--color-agentic-surface) / <alpha-value>)',
          text: 'rgb(var(--color-agentic-text) / <alpha-value>)',
        }
      },
      fontFamily: {
        sans: ['Funnel Display', 'sans-serif'],
        display: ['Funnel Display', 'sans-serif'],
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

