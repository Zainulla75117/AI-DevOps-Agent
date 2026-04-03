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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    // Validation
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
        console.log('Registration successful!', response)
        
        // Redirect to login page after a short delay
        setTimeout(() => {
          navigate('/login')
        }, 2000)
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 
        err.response?.data?.detail || 
        err.message || 
        'Registration failed. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold text-slate-900 mb-2">
          Create your account
        </h2>
        <p className="text-sm text-slate-600">
          Sign up to get started
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
            className="w-full px-4 py-3 bg-white border border-[#2196F3]/20 text-slate-900 text-base rounded-md transition-colors outline-none placeholder:text-slate-400 focus:border-[#4CAF50] focus:ring-2 focus:ring-[#4CAF50]/20 disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="Enter your username"
            disabled={isLoading}
            autoComplete="username"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-white border border-[#2196F3]/20 text-slate-900 text-base rounded-md transition-colors outline-none placeholder:text-slate-400 focus:border-[#4CAF50] focus:ring-2 focus:ring-[#4CAF50]/20 disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="Enter your email"
            disabled={isLoading}
            autoComplete="email"
            required
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
              className="w-full px-4 py-3 pr-12 bg-white border border-[#2196F3]/20 text-slate-900 text-base rounded-md transition-colors outline-none placeholder:text-slate-400 focus:border-[#4CAF50] focus:ring-2 focus:ring-[#4CAF50]/20 disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="At least 6 characters"
              disabled={isLoading}
              autoComplete="new-password"
              required
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

        <div className="flex flex-col gap-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full px-4 py-3 pr-12 bg-white border border-[#2196F3]/20 text-slate-900 text-base rounded-md transition-colors outline-none placeholder:text-slate-400 focus:border-[#4CAF50] focus:ring-2 focus:ring-[#4CAF50]/20 disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Re-enter password"
              disabled={isLoading}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors focus:outline-none"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? (
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

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-md" 
               role="alert">
            <span>⚠️</span>
            <span className="break-words">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm bg-green-50 border border-green-200 text-green-700 rounded-md"
               role="alert">
            <span>✅</span>
            <span className="break-words">Registration successful! Redirecting to login...</span>
          </div>
        )}

        <button
          type="submit"
          className="w-full px-4 py-3 bg-gradient-to-r from-[#42A5F5] to-[#66BB6A] text-white text-base font-medium rounded-md transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:from-[#1E88E5] hover:to-[#4CAF50] active:from-[#1976D2] active:to-[#43A047]"
          disabled={isLoading}
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

        <div className="text-center pt-2">
          <p className="text-sm text-slate-600">
            Already have an account?{' '}
            <Link 
              to="/login" 
              className="text-[#1E88E5] font-medium hover:text-[#43A047] transition-colors underline"
            >
              Sign In
            </Link>
          </p>
        </div>
      </form>
    </div>
  )
}

export default RegistrationForm

