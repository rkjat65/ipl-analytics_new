import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function LoginPage({ inline = false }) {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [isRegister, setIsRegister] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleLoaded, setGoogleLoaded] = useState(false)
  const googleBtnRef = useRef(null)

  // Redirect if already authenticated (only for standalone /login page)
  useEffect(() => {
    if (!inline && isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, inline, navigate])

  // Handle Google credential response
  const handleGoogleResponse = useCallback(async (response) => {
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Google sign-in failed')
      }
      const data = await res.json()
      login(data.token, data.user)
      if (!inline) navigate('/', { replace: true })
    } catch (err) {
      setSubmitError(err.message || 'Google sign-in failed')
    } finally {
      setSubmitting(false)
    }
  }, [login, navigate, inline])

  // Load Google GSI script
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
    if (existingScript && window.google?.accounts?.id) {
      initializeGoogle()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = initializeGoogle
    document.body.appendChild(script)

    function initializeGoogle() {
      if (!window.google?.accounts?.id) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      })
      setGoogleLoaded(true)
    }
  }, [handleGoogleResponse])

  // Render Google button when ready
  useEffect(() => {
    if (googleLoaded && googleBtnRef.current && window.google?.accounts?.id) {
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black',
        size: 'large',
        width: googleBtnRef.current.offsetWidth || 320,
        text: 'signin_with',
      })
    }
  }, [googleLoaded, isRegister])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear field error on change
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
    setSubmitError('')
  }

  const validate = () => {
    const newErrors = {}
    if (isRegister && !formData.name.trim()) {
      newErrors.name = 'Name is required'
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Invalid email format'
    }
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    if (isRegister) {
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password'
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setSubmitError('')

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'
    const body = isRegister
      ? { name: formData.name, email: formData.email, password: formData.password }
      : { email: formData.email, password: formData.password }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || (isRegister ? 'Registration failed' : 'Invalid credentials'))
      }
      const data = await res.json()
      login(data.token, data.user)
      if (!inline) navigate('/', { replace: true })
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleMode = () => {
    setIsRegister(prev => !prev)
    setErrors({})
    setSubmitError('')
    setFormData({ name: '', email: '', password: '', confirmPassword: '' })
  }

  const formContent = (
    <div className={`w-full max-w-md mx-auto ${inline ? '' : 'min-h-screen flex items-center justify-center px-4'}`}>
      <div
        className={`w-full animate-pop ${inline ? '' : 'my-8'}`}
      >
        {/* Gradient border wrapper */}
        <div className="p-[1px] rounded-2xl bg-gradient-to-br from-accent-cyan/40 via-accent-magenta/20 to-accent-lime/30">
          <div className="bg-[#111118] rounded-2xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-accent-cyan/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-heading font-bold text-text-primary">
                  {isRegister ? 'Create Account' : 'Sign In'}
                </h2>
              </div>
              <p className="text-text-secondary text-sm">
                {isRegister
                  ? 'Join IPL Analytics for full access'
                  : 'Access comprehensive IPL analytics'}
              </p>
            </div>

            {/* Submit error */}
            {submitError && (
              <div className="mb-6 p-3 rounded-lg bg-accent-magenta/10 border border-accent-magenta/30 animate-in-fast">
                <p className="text-accent-magenta text-sm text-center">{submitError}</p>
              </div>
            )}

            {/* Google Sign-In */}
            {GOOGLE_CLIENT_ID && (
              <>
                <div ref={googleBtnRef} className="w-full flex justify-center mb-6" />

                {/* Divider */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 h-px bg-[#1E1E2A]" />
                  <span className="text-text-muted text-xs uppercase tracking-wider font-medium">or</span>
                  <div className="flex-1 h-px bg-[#1E1E2A]" />
                </div>
              </>
            )}

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Name field (register only) */}
              {isRegister && (
                <div>
                  <label htmlFor="auth-name" className="block text-text-secondary text-sm font-medium mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    className={`w-full px-4 py-2.5 rounded-lg bg-[#0A0A0F] border text-text-primary text-sm placeholder-text-muted/50
                      focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/60 transition-all
                      ${errors.name ? 'border-accent-magenta/60' : 'border-[#1E1E2A]'}`}
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-accent-magenta">{errors.name}</p>
                  )}
                </div>
              )}

              {/* Email */}
              <div>
                <label htmlFor="auth-email" className="block text-text-secondary text-sm font-medium mb-1.5">
                  Email
                </label>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`w-full px-4 py-2.5 rounded-lg bg-[#0A0A0F] border text-text-primary text-sm placeholder-text-muted/50
                    focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/60 transition-all
                    ${errors.email ? 'border-accent-magenta/60' : 'border-[#1E1E2A]'}`}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-accent-magenta">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="auth-password" className="block text-text-secondary text-sm font-medium mb-1.5">
                  Password
                </label>
                <input
                  id="auth-password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Min. 6 characters"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  className={`w-full px-4 py-2.5 rounded-lg bg-[#0A0A0F] border text-text-primary text-sm placeholder-text-muted/50
                    focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/60 transition-all
                    ${errors.password ? 'border-accent-magenta/60' : 'border-[#1E1E2A]'}`}
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-accent-magenta">{errors.password}</p>
                )}
              </div>

              {/* Confirm Password (register only) */}
              {isRegister && (
                <div>
                  <label htmlFor="auth-confirm-password" className="block text-text-secondary text-sm font-medium mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    id="auth-confirm-password"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    className={`w-full px-4 py-2.5 rounded-lg bg-[#0A0A0F] border text-text-primary text-sm placeholder-text-muted/50
                      focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/60 transition-all
                      ${errors.confirmPassword ? 'border-accent-magenta/60' : 'border-[#1E1E2A]'}`}
                  />
                  {errors.confirmPassword && (
                    <p className="mt-1 text-xs text-accent-magenta">{errors.confirmPassword}</p>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-accent-cyan text-black font-bold text-sm
                  hover:brightness-110 active:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2"
              >
                {submitting && (
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                )}
                {isRegister ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            {/* Toggle Login/Register */}
            <div className="mt-6 text-center">
              <p className="text-text-muted text-sm">
                {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  onClick={toggleMode}
                  className="text-accent-cyan hover:underline font-medium transition-colors"
                >
                  {isRegister ? 'Sign In' : 'Create Account'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Inline mode: overlay with blurred background
  if (inline) {
    return (
      <div className="relative min-h-[60vh] flex items-center justify-center">
        {/* Blurred placeholder background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10 blur-sm pointer-events-none select-none">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#1E1E2A] mx-auto mb-4" />
            <div className="h-4 w-48 bg-[#1E1E2A] rounded mx-auto mb-2" />
            <div className="h-3 w-32 bg-[#1E1E2A] rounded mx-auto" />
          </div>
        </div>

        {/* Login form overlay */}
        <div className="relative z-10 w-full">
          {formContent}
        </div>
      </div>
    )
  }

  // Standalone page mode
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {formContent}
    </div>
  )
}
