import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signup } from '../services/authService'

const RegistrationForm = ({ isLoading, setIsLoading }) => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    setError('')
  }

  const calculateStrength = (pwd) => {
    let score = 0;
    if (pwd.length > 5) score += 1;
    if (pwd.length > 8) score += 1;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setIsLoading(true)

    try {
      const response = await signup({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      })
      
      if (response) {
        setSuccess(true)
        setTimeout(() => { navigate('/login') }, 2500)
      }
    } catch (err) {
      setError(
        err.response?.data?.message || err.response?.data?.detail || err.message || 'Registration failed. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row justify-between items-center md:items-start mb-6 md:mb-8 text-center md:text-left gap-4 md:gap-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-1 md:mb-2 md:mt-2 font-display">
            Create an account
          </h2>
          <p className="text-sm text-slate-600">
            Sign up to get started with infraXai
          </p>
        </div>
        
        <div className="flex flex-col items-center md:items-end gap-1.5 pt-1 w-full md:w-auto">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Continue with</span>
          <div className="flex gap-2 justify-center md:justify-end w-full">
            <button
              type="button"
              onClick={() => console.log('Google signup clicked')}
              className="rounded-xl p-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 active:bg-slate-100 flex items-center justify-center outline-none"
              title="Continue with Google"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </button>

            <button
              type="button"
              onClick={() => console.log('GitHub signup clicked')}
              className="rounded-xl p-2.5 bg-[#24292F] hover:bg-[#1b1f23] text-white shadow-sm hover:shadow-md transition-all duration-200 active:bg-slate-900 flex items-center justify-center border border-transparent outline-none"
              title="Continue with GitHub"
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className="text-sm font-medium text-slate-700 text-left">
            Username
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            className="rounded-xl w-full px-5 py-4 md:py-3.5 bg-white border border-[#2196F3]/20 text-slate-900 text-sm transition-all duration-300 outline-none placeholder:text-slate-400 shadow-sm hover:shadow focus:border-[#30705d] focus:ring-[3px] focus:ring-[#30705d]/20 focus:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="Choose a username"
            disabled={isLoading}
            autoComplete="username"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-slate-700 text-left">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="rounded-xl w-full px-5 py-4 md:py-3.5 bg-white border border-[#2196F3]/20 text-slate-900 text-sm transition-all duration-300 outline-none placeholder:text-slate-400 shadow-sm hover:shadow focus:border-[#30705d] focus:ring-[3px] focus:ring-[#30705d]/20 focus:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="you@company.com"
            disabled={isLoading}
            autoComplete="email"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-slate-700 text-left">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="rounded-xl w-full px-5 py-4 md:py-3.5 pr-12 bg-white border border-[#2196F3]/20 text-slate-900 text-sm transition-all duration-300 outline-none placeholder:text-slate-400 shadow-sm hover:shadow focus:border-[#30705d] focus:ring-[3px] focus:ring-[#30705d]/20 focus:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Create a password"
              disabled={isLoading}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0A9.97 9.97 0 015.12 5.12m3.17 1.17L3 3m0 0l18 18m-3.29-3.29a9.97 9.97 0 01-1.563 3.029M12 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              )}
            </button>
          </div>
          {formData.password && (
            <div className="flex gap-1 mt-1">
              {[1, 2, 3].map((level) => (
                <div 
                  key={level} 
                  className={`rounded-full h-1.5 flex-1 transition-colors duration-300 ${
                    calculateStrength(formData.password) >= level 
                      ? (level === 1 ? 'bg-red-400' : level === 2 ? 'bg-amber-400' : 'bg-emerald-500')
                      : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700 text-left">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="rounded-xl w-full px-5 py-4 md:py-3.5 pr-12 bg-white border border-[#2196F3]/20 text-slate-900 text-sm transition-all duration-300 outline-none placeholder:text-slate-400 shadow-sm hover:shadow focus:border-[#30705d] focus:ring-[3px] focus:ring-[#30705d]/20 focus:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Confirm your password"
              disabled={isLoading}
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl flex items-center gap-2 text-sm text-red-600 bg-red-50 p-4 border border-red-100" role="alert">
            <span className="font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-xl flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 p-5 border border-emerald-100 animate-in fade-in duration-300" role="alert">
            <div className="flex flex-col">
              <span className="font-semibold">Account created successfully!</span>
              <span className="text-emerald-600/90 mt-0.5">Redirecting you to login...</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          className="rounded-xl w-full mt-3 px-4 py-3.5 bg-gradient-to-br from-[#42A5F5] to-[#30705d] text-white text-sm font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] border-none"
          disabled={isLoading || success}
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Creating Account...
            </>
          ) : (
            'Create Account'
          )}
        </button>

        <p className="text-xs text-slate-500 text-center mt-3 font-medium">
          By signing up, you agree to our <a href="#" className="underline hover:text-slate-700">Terms of Service</a> and <a href="#" className="underline hover:text-slate-700">Privacy Policy</a>.
        </p>

        <div className="text-center pt-4 pb-4 border-t border-slate-200 mt-2">
          <p className="text-sm text-slate-600 font-medium">
            Already have an account?{' '}
            <Link 
              to="/login" 
              className="text-[#1E88E5] font-semibold hover:text-[#215646] transition-colors"
            >
              Log in
            </Link>
          </p>
        </div>
      </form>
    </div>
  )
}

export default RegistrationForm
