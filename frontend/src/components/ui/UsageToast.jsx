import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../../hooks/useSubscription'
import { useAuth } from '../../contexts/AuthContext'

const FEATURE_NAMES = {
  ai_query: 'AI queries',
  ai_caption: 'AI captions',
  ai_image: 'AI infographics',
  ai_thread: 'AI threads',
}

/**
 * UsageToast — shows a subtle notification when user is running low on quota.
 * Place once in the app layout. Checks usage after each refresh.
 */
export default function UsageToast() {
  const { isAuthenticated } = useAuth()
  const { usage, plan } = useSubscription()
  const navigate = useNavigate()
  const [toast, setToast] = useState(null)
  const [dismissed, setDismissed] = useState({})

  useEffect(() => {
    if (!isAuthenticated || plan === 'ultimate') return

    // Find the first feature that's running low (1 remaining) or exhausted
    for (const [key, u] of Object.entries(usage)) {
      if (u.limit <= 0 || u.limit === -1) continue
      if (dismissed[key]) continue

      if (u.remaining === 0) {
        setToast({ feature: key, type: 'exhausted', label: FEATURE_NAMES[key] || key })
        return
      }
      if (u.remaining === 1) {
        setToast({ feature: key, type: 'low', label: FEATURE_NAMES[key] || key, remaining: 1 })
        return
      }
    }
    setToast(null)
  }, [usage, isAuthenticated, plan, dismissed])

  if (!toast) return null

  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-sm animate-in slide-in-from-bottom-4">
      <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-sm ${
        toast.type === 'exhausted'
          ? 'bg-red-950/90 border-red-800/50'
          : 'bg-amber-950/90 border-amber-800/50'
      }`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          toast.type === 'exhausted' ? 'bg-red-900/50' : 'bg-amber-900/50'
        }`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`w-4 h-4 ${toast.type === 'exhausted' ? 'text-red-400' : 'text-amber-400'}`}>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${toast.type === 'exhausted' ? 'text-red-300' : 'text-amber-300'}`}>
            {toast.type === 'exhausted'
              ? `No ${toast.label} remaining`
              : `Only ${toast.remaining} ${toast.label} left today`}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {toast.type === 'exhausted'
              ? 'Upgrade for more daily usage.'
              : 'Consider upgrading for higher limits.'}
          </p>
          <button
            onClick={() => { setDismissed(d => ({ ...d, [toast.feature]: true })); navigate('/pricing') }}
            className="mt-2 text-xs font-mono font-semibold text-accent-cyan hover:text-accent-cyan/80 transition-colors"
          >
            View Plans →
          </button>
        </div>
        <button
          onClick={() => setDismissed(d => ({ ...d, [toast.feature]: true }))}
          className="text-gray-500 hover:text-gray-300 transition-colors shrink-0"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
