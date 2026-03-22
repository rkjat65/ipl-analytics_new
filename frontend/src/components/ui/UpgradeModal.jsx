import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../../hooks/useSubscription'

const FEATURE_NAMES = {
  ai_query: 'AI Queries',
  ai_caption: 'AI Captions',
  ai_image: 'AI Infographics',
  ai_thread: 'AI Threads',
}

const PLAN_LIMITS = {
  free: { ai_query: 5, ai_caption: 3, ai_image: 0, ai_thread: 2 },
  pro: { ai_query: 50, ai_caption: 30, ai_image: 10, ai_thread: 20 },
  ultimate: { ai_query: '∞', ai_caption: '∞', ai_image: 50, ai_thread: '∞' },
}

export default function UpgradeModal({ feature, onClose }) {
  const navigate = useNavigate()
  const { plan, getUsageInfo } = useSubscription()
  const info = getUsageInfo(feature)
  const featureName = FEATURE_NAMES[feature] || feature

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-bg-card border border-border-subtle rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient top bar */}
        <div className="h-1 bg-gradient-to-r from-accent-cyan via-purple-500 to-accent-magenta" />

        <div className="p-6">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-amber-400">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-center font-heading font-bold text-text-primary text-lg mb-1">
            {info?.limit === 0 ? `${featureName} — Pro Feature` : 'Daily Limit Reached'}
          </h3>
          <p className="text-center text-text-muted text-sm mb-6">
            {info?.limit === 0
              ? `${featureName} are not available on the Free plan.`
              : `You've used all ${info?.limit} ${featureName.toLowerCase()} for today.`}
          </p>

          {/* Plan comparison mini-table */}
          <div className="rounded-xl border border-border-subtle overflow-hidden mb-6">
            <div className="grid grid-cols-4 bg-bg-elevated/50 text-[11px] font-mono text-text-muted uppercase tracking-wider">
              <div className="p-2.5 pl-4">Feature</div>
              <div className="p-2.5 text-center">Free</div>
              <div className="p-2.5 text-center text-accent-cyan">Pro</div>
              <div className="p-2.5 text-center text-purple-400">Ultimate</div>
            </div>
            {Object.entries(FEATURE_NAMES).map(([key, label]) => (
              <div
                key={key}
                className={`grid grid-cols-4 text-sm border-t border-border-subtle ${key === feature ? 'bg-amber-500/5' : ''}`}
              >
                <div className={`p-2.5 pl-4 font-mono text-xs ${key === feature ? 'text-amber-400 font-semibold' : 'text-text-secondary'}`}>
                  {label}
                </div>
                <div className="p-2.5 text-center text-text-muted text-xs">
                  {PLAN_LIMITS.free[key]}{PLAN_LIMITS.free[key] === 0 ? '' : '/day'}
                </div>
                <div className="p-2.5 text-center text-accent-cyan text-xs font-semibold">
                  {PLAN_LIMITS.pro[key]}/day
                </div>
                <div className="p-2.5 text-center text-purple-400 text-xs font-semibold">
                  {PLAN_LIMITS.ultimate[key] === '∞' ? '∞' : `${PLAN_LIMITS.ultimate[key]}/day`}
                </div>
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="space-y-2">
            <button
              onClick={() => { onClose(); navigate('/pricing') }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-cyan to-cyan-400 text-bg-primary font-heading font-bold text-sm hover:opacity-90 transition-all"
            >
              View Plans & Upgrade
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-text-muted text-sm font-mono hover:text-text-secondary transition-colors"
            >
              Maybe later
            </button>
          </div>

          <p className="text-center text-[10px] text-text-muted font-mono mt-4">
            Usage resets daily at midnight UTC
          </p>
        </div>
      </div>
    </div>
  )
}
