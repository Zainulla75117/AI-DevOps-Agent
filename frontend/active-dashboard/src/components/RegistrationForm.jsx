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
        }, 2500)
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
      <div className="mb-8 relative">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
          Join DevOps Infinity
        </h2>
        <p className="text-base text-slate-600">
          Let's build the future together. Setup takes 30 seconds.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className="text-sm font-semibold text-slate-700">
            Username
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 text-base rounded-xl transition-all outline-none placeholder:text-slate-400 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="e.g. cloud_ninja"
            disabled={isLoading}
            autoComplete="username"
            required
          />
          {formData.username && formData.username.length > 2 && (
            <p className="text-sm text-violet-600 animate-in fade-in slide-in-from-top-1 px-1">
              Perfect username, <span className="font-bold">{formData.username}</span>! 🚀
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-semibold text-slate-700">
            Work Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 text-base rounded-xl transition-all outline-none placeholder:text-slate-400 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="you@company.com"
            disabled={isLoading}
            autoComplete="email"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-semibold text-slate-700">
            Secure Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 text-slate-900 text-base rounded-xl transition-all outline-none placeholder:text-slate-400 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Requires at least 6 secure characters"
              disabled={isLoading}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-violet-600 bg-white rounded-lg transition-colors focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0A9.97 9.97 0 015.12 5.12m3.17 1.17L3 3m0 0l18 18m-3.29-3.29a9.97 9.97 0 01-1.563 3.029M12 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 text-slate-900 text-base rounded-xl transition-all outline-none placeholder:text-slate-400 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Verify your sequence"
              disabled={isLoading}
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-xl" role="alert">
            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">⚠️</div>
            <span className="font-medium break-words">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-3 px-4 py-4 text-sm bg-violet-50 border border-violet-200 text-violet-800 rounded-xl animate-in flip-in-x duration-500" role="alert">
            <div className="w-8 h-8 rounded-full bg-violet-200 flex items-center justify-center flex-shrink-0 text-lg">🎉</div>
            <div className="flex flex-col">
              <span className="font-bold">Welcome aboard, Originator!</span>
              <span>Your VIP account is ready. Taking you to the portal...</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          className="w-full mt-2 px-4 py-3.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-base font-bold rounded-xl shadow-lg shadow-violet-500/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] hover:shadow-violet-500/40 active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed"
          disabled={isLoading || success}
        >
          {isLoading ? (
            <>
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Provisioning Environment...
            </>
          ) : (
            'Claim Your Access'
          )}
        </button>

        <div className="text-center pt-4 border-t border-slate-100 mt-2">
          <p className="text-sm text-slate-500">
            Already have elite access?{' '}
            <Link 
              to="/login" 
              className="text-violet-600 font-bold hover:text-fuchsia-600 transition-colors underline underline-offset-2"
            >
              Sign In Here
            </Link>
          </p>
        </div>
      </form>
    </div>
  )
}

export default RegistrationForm
