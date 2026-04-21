import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * GitHubCallbackPage
 * 
 * This page is the OAuth redirect target. GitHub redirects here after
 * the user authorizes the app. The backend has already exchanged the
 * authorization code for a JWT and appended it as URL query params.
 * 
 * Flow:
 *   GitHub → backend /github/callback → redirect here with ?token=...&username=...
 *   This page reads the params, stores them in localStorage, and navigates to /home.
 */
const GitHubCallbackPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('Processing GitHub login...')

  useEffect(() => {
    const token = searchParams.get('token')
    const username = searchParams.get('username')
    const email = searchParams.get('email') || ''
    const avatarUrl = searchParams.get('avatar_url') || ''

    if (!token || !username) {
      setStatus('GitHub login failed. Missing token or user data.')
      setTimeout(() => navigate('/login'), 2000)
      return
    }

    // Store auth data (same keys as regular login)
    localStorage.setItem('jwt_token', token)
    localStorage.setItem('token_type', 'bearer')
    localStorage.setItem('user_info', JSON.stringify({
      username,
      email,
      avatar_url: avatarUrl,
      auth_provider: 'github',
    }))

    console.log('✅ GitHub OAuth login successful:', { username, email })

    setStatus('Login successful! Redirecting...')
    setTimeout(() => navigate('/home'), 500)
  }, [searchParams, navigate])

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-sm text-slate-600 font-medium">{status}</p>
      </div>
    </div>
  )
}

export default GitHubCallbackPage
