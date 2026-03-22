import { useSubscription } from '../../hooks/useSubscription'
import { useAuth } from '../../contexts/AuthContext'

const PLAN_COLORS = {
  free: { bg: 'bg-gray-800/50', border: 'border-gray-700', text: 'text-gray-400', badge: 'bg-gray-700 text-gray-300' },
  pro: { bg: 'bg-cyan-900/20', border: 'border-cyan-800/40', text: 'text-cyan-400', badge: 'bg-cyan-900/50 text-cyan-300' },
  ultimate: { bg: 'bg-purple-900/20', border: 'border-purple-800/40', text: 'text-purple-400', badge: 'bg-purple-900/50 text-purple-300' },
}

/**
 * PaywallGate wraps an AI action button.
 * - Shows remaining usage count
 * - Disables button when limit reached
 * - Shows upgrade prompt when blocked
 *
 * Usage:
 *   <PaywallGate feature="ai_query">
 *     {({ disabled, remaining, onAction }) => (
 *       <button disabled={disabled} onClick={() => { onAction(); doQuery(); }}>
 *         Ask ({remaining} left)
 *       </button>
 *     )}
 *   </PaywallGate>
 */
export default function PaywallGate({ feature, children, onUpgrade }) {
  const { isAuthenticated } = useAuth()
  const { canUse, getRemaining, getUsageInfo, plan, refresh } = useSubscription()

  const allowed = canUse(feature)
  const remaining = getRemaining(feature)
  const info = getUsageInfo(feature)

  // Not logged in — allow (backend will handle unauthenticated users)
  if (!isAuthenticated) {
    return children({ disabled: false, remaining: null, plan: 'free', onAction: () => {} })
  }

  const handleAction = () => {
    // After the AI call completes, refresh usage
    setTimeout(() => refresh(), 1000)
  }

  return children({
    disabled: !allowed,
    remaining: remaining === Infinity ? null : remaining,
    limit: info?.limit ?? null,
    used: info?.used ?? 0,
    plan,
    onAction: handleAction,
    onUpgrade: onUpgrade || (() => {}),
  })
}

/**
 * UsageBadge — small inline badge showing remaining usage
 */
export function UsageBadge({ feature }) {
  const { isAuthenticated } = useAuth()
  const { getRemaining, getUsageInfo, plan } = useSubscription()

  if (!isAuthenticated) return null

  const remaining = getRemaining(feature)
  const info = getUsageInfo(feature)
  if (!info) return null

  const colors = PLAN_COLORS[plan] || PLAN_COLORS.free

  if (info.limit === -1) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono ${colors.badge}`}>
        Unlimited
      </span>
    )
  }

  if (info.limit === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-red-900/30 text-red-400 border border-red-800/40">
        Pro only
      </span>
    )
  }

  const isLow = remaining !== null && remaining <= 1
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono ${isLow ? 'bg-amber-900/30 text-amber-400 border border-amber-800/40' : colors.badge}`}>
      {remaining}/{info.limit} left
    </span>
  )
}

/**
 * UpgradePrompt — shown when user hits limit
 */
export function UpgradePrompt({ feature, onUpgrade }) {
  const info = useSubscription().getUsageInfo(feature)

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-900/20 border border-amber-800/40">
      <div className="flex-1">
        <p className="text-amber-400 text-sm font-semibold">
          {info?.limit === 0 ? 'Not available on Free plan' : 'Daily limit reached'}
        </p>
        <p className="text-gray-400 text-xs mt-0.5">
          Upgrade to Pro for more {info?.label || 'AI features'}
        </p>
      </div>
      <button
        onClick={onUpgrade}
        className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Upgrade
      </button>
    </div>
  )
}
