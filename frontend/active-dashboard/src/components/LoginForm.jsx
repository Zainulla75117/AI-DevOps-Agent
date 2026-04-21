import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../services/authService'

const LoginForm = ({ isLoading, setIsLoading, onToast }) => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (onToast) onToast(null)

    if (!formData.username || !formData.password) {
      if (onToast) {
        onToast({
          message: 'Please fill in all fields',
          type: 'error',
        })
      }
      return
    }

    setIsLoading(true)

    try {
      const response = await login(formData.username, formData.password)
      
      // Check if response has access_token (200 status means success)
      if (response.access_token) {
        // Token and user info are already stored in login function
        if (onToast) {
          onToast({
            message: 'Login successful! Redirecting...',
            type: 'success',
          })
        }
        
        console.log('Login successful! Token:', response.access_token)
        console.log('User info:', response.user)
        
        // Redirect to home page after a short delay
        setTimeout(() => {
          navigate('/home')
        }, 1000)
      } else {
        if (onToast) {
          onToast({
            message: 'Invalid response from server',
            type: 'error',
          })
        }
      }
    } catch (err) {
      if (onToast) {
        onToast({
          message: err.response?.data?.message || 
                  err.message || 
                  'Login failed. Please check your credentials.',
          type: 'error',
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 md:mb-8 text-center md:text-left">
        <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-1 md:mb-2 font-display">
          Welcome
        </h2>
        <p className="text-sm text-slate-600">
          Sign in to your account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="username" className="text-sm font-medium text-slate-700">
            Username
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            className="w-full px-4 py-3.5 md:py-3 bg-slate-50 md:bg-white border border-[#2196F3]/20 text-slate-900 text-base rounded-xl md:rounded-md transition-colors outline-none placeholder:text-slate-400 focus:bg-white focus:border-[#30705d] focus:ring-2 focus:ring-[#30705d]/20 disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="Enter your username"
            disabled={isLoading}
            autoComplete="username"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3.5 md:py-3 pr-12 bg-slate-50 md:bg-white border border-[#2196F3]/20 text-slate-900 text-base rounded-xl md:rounded-md transition-colors outline-none placeholder:text-slate-400 focus:bg-white focus:border-[#30705d] focus:ring-2 focus:ring-[#30705d]/20 disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Enter your password"
              disabled={isLoading}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0A9.97 9.97 0 015.12 5.12m3.17 1.17L3 3m0 0l18 18m-3.29-3.29a9.97 9.97 0 01-1.563 3.029M12 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="w-full mt-2 md:mt-0 px-4 py-3.5 md:py-3 bg-gradient-to-br from-[#42A5F5] to-[#30705d] text-white text-base font-semibold md:font-medium rounded-xl md:rounded-md transition-all flex items-center justify-center gap-2 hover:shadow-lg md:hover:shadow-none disabled:opacity-70 disabled:cursor-not-allowed hover:from-[#1E88E5] hover:to-[#215646] active:from-[#1976D2] active:to-[#1a4135]"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>

        <div className="relative flex items-center">
          <div className="flex-1 border-t border-slate-300"></div>
          <span className="px-3 text-sm text-slate-500">or</span>
          <div className="flex-1 border-t border-slate-300"></div>
        </div>

        <button
          type="button"
          onClick={() => {
            const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
            if (!clientId) {
              if (onToast) {
                onToast({
                  message: 'Google login is not configured. Please contact the administrator.',
                  type: 'error',
                })
              }
              return
            }
            const redirectUri = encodeURIComponent('http://localhost:8000/api/users/google/callback')
            window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid%20email%20profile&access_type=offline`
          }}
          className="w-full px-4 py-3.5 md:py-3 bg-white border border-slate-300 text-slate-700 text-base font-semibold md:font-medium rounded-xl md:rounded-md transition-all flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-400 shadow-sm md:shadow-none active:bg-slate-100"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
            if (!clientId) {
              if (onToast) {
                onToast({
                  message: 'GitHub login is not configured. Please contact the administrator.',
                  type: 'error',
                })
              }
              return
            }
            const redirectUri = encodeURIComponent('http://localhost:8000/api/users/github/callback')
            window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email`
          }}
          className="w-full px-4 py-3.5 md:py-3 bg-white border border-slate-300 text-slate-700 text-base font-semibold md:font-medium rounded-xl md:rounded-md transition-all flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-400 shadow-sm md:shadow-none active:bg-slate-100"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
          </svg>
          <span>Continue with GitHub</span>
        </button>

        <div className="text-center pt-2">
          <p className="text-sm text-slate-600">
            Don't have an account?{' '}
            <Link 
              to="/register" 
              className="text-[#1E88E5] font-medium hover:text-[#215646] transition-colors underline"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </form>
    </div>
  )
}

export default LoginForm

