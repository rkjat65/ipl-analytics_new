import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '../components/SEO'
import { useAuth } from '../contexts/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import { getBillingPlans, getPaymentStatus, createSubscription, verifyPayment } from '../lib/api'

const PLAN_FEATURES = {
  free: {
    tagline: 'Get started with IPL analytics',
    highlights: [
      'Full access to all analytics pages',
      'Match, player, team & venue stats',
      'Head-to-head comparisons',
      'Content Studio (export cards)',
      '5 AI queries/day',
      '3 AI captions/day',
      '2 AI threads/day',
    ],
    cta: 'Current Plan',
    color: 'gray',
  },
  pro: {
    tagline: 'For serious cricket analysts',
    highlights: [
      'Everything in Free, plus:',
      '50 AI queries/day',
      '30 AI captions/day',
      '10 AI infographics/day',
      '20 AI threads/day',
      'Priority AI model access',
      'Advanced export formats',
    ],
    cta: 'Upgrade to Pro',
    color: 'cyan',
    popular: true,
  },
  ultimate: {
    tagline: 'Unlimited power for content creators',
    highlights: [
      'Everything in Pro, plus:',
      'Unlimited AI queries',
      'Unlimited AI captions',
      '50 AI infographics/day',
      'Unlimited AI threads',
      'Early access to new features',
      'Priority support',
    ],
    cta: 'Go Ultimate',
    color: 'purple',
  },
}

const COLOR_MAP = {
  gray: {
    border: 'border-gray-700',
    bg: 'bg-gray-800/30',
    accent: 'text-gray-400',
    btn: 'bg-gray-700 text-gray-300 cursor-default',
    glow: '',
  },
  cyan: {
    border: 'border-accent-cyan/40',
    bg: 'bg-cyan-900/10',
    accent: 'text-accent-cyan',
    btn: 'bg-gradient-to-r from-accent-cyan to-cyan-400 text-bg-primary hover:opacity-90',
    glow: 'shadow-[0_0_40px_rgba(0,229,255,0.12)]',
  },
  purple: {
    border: 'border-purple-500/40',
    bg: 'bg-purple-900/10',
    accent: 'text-purple-400',
    btn: 'bg-gradient-to-r from-purple-500 to-purple-400 text-white hover:opacity-90',
    glow: 'shadow-[0_0_40px_rgba(139,92,246,0.12)]',
  },
}

// Load Razorpay script dynamically
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-script')) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.id = 'razorpay-script'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function Pricing() {
  const navigate = useNavigate()
  const { isAuthenticated, token, user } = useAuth()
  const { plan: currentPlan, usage, refresh } = useSubscription()
  const [plans, setPlans] = useState(null)
  const [paymentReady, setPaymentReady] = useState(false)
  const [razorpayKeyId, setRazorpayKeyId] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const FALLBACK_PRICES = { free: null, pro: 299, ultimate: 599 }

  useEffect(() => {
    getBillingPlans().then(d => setPlans(d.plans)).catch(() => {})
    getPaymentStatus().then(d => {
      setPaymentReady(d.available)
      if (d.key_id) setRazorpayKeyId(d.key_id)
    }).catch(() => {})
  }, [])

  const handleUpgrade = useCallback(async (planId) => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    if (!paymentReady) {
      alert('Payments are not configured yet. Contact @Crickrida for early access.')
      return
    }

    setCheckoutLoading(planId)

    try {
      // 1. Load Razorpay JS
      const loaded = await loadRazorpayScript()
      if (!loaded) throw new Error('Failed to load Razorpay SDK')

      // 2. Create subscription on backend
      const subData = await createSubscription(planId, token)

      // 3. Open Razorpay popup
      const options = {
        key: subData.key_id || razorpayKeyId,
        subscription_id: subData.subscription_id,
        name: subData.name,
        description: subData.description,
        currency: subData.currency,
        prefill: subData.prefill || {},
        theme: {
          color: '#00E5FF',
          backdrop_color: 'rgba(10,10,15,0.85)',
        },
        modal: {
          confirm_close: true,
          ondismiss: () => setCheckoutLoading(null),
        },
        handler: async (response) => {
          // 4. Verify payment on backend
          try {
            const result = await verifyPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
              plan: planId,
            }, token)

            if (result.verified) {
              setSuccessMsg(`Payment successful! Upgraded to ${planId.charAt(0).toUpperCase() + planId.slice(1)} plan.`)
              refresh()
            }
          } catch (err) {
            alert('Payment received but verification failed. Contact support.')
          } finally {
            setCheckoutLoading(null)
          }
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (resp) => {
        alert(`Payment failed: ${resp.error?.description || 'Unknown error'}`)
        setCheckoutLoading(null)
      })
      rzp.open()

    } catch (err) {
      alert(err.message || 'Failed to start checkout')
      setCheckoutLoading(null)
    }
  }, [isAuthenticated, paymentReady, token, razorpayKeyId, navigate, refresh])

  return (
    <>
      <SEO title="Pricing" description="Choose the right plan for your cricket analytics needs" />
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-xs font-mono font-semibold mb-4">
              PRICING
            </div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-text-primary mb-3">
              Power up your cricket analytics
            </h1>
            <p className="text-text-secondary text-sm md:text-base max-w-xl mx-auto">
              Free analytics for everyone. Unlock AI-powered insights, infographics, and content generation with Pro and Ultimate plans.
            </p>
          </div>

          {/* Success message */}
          {successMsg && (
            <div className="mb-8 p-4 rounded-xl bg-green-900/20 border border-green-800/40 text-green-400 text-sm text-center font-mono flex items-center justify-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {successMsg}
            </div>
          )}

          {/* Usage Dashboard (logged-in users only) */}
          {isAuthenticated && Object.keys(usage).length > 0 && (
            <div className="mb-10 p-5 rounded-2xl border border-border-subtle bg-bg-card/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-bold text-text-primary text-sm">Today's Usage</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                    currentPlan === 'ultimate' ? 'bg-purple-900/30 text-purple-400 border border-purple-800/30'
                    : currentPlan === 'pro' ? 'bg-cyan-900/30 text-accent-cyan border border-cyan-800/30'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}>
                    {currentPlan} plan
                  </span>
                </div>
                <p className="text-[10px] text-text-muted font-mono">Resets at midnight UTC</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(usage).map(([key, u]) => {
                  const pct = u.limit > 0 ? Math.min(100, (u.used / u.limit) * 100) : u.limit === -1 ? 0 : 100
                  const isLow = u.limit > 0 && u.remaining <= 1
                  const isUnlimited = u.limit === -1
                  const isBlocked = u.limit === 0
                  return (
                    <div key={key} className={`p-3 rounded-xl border ${isLow ? 'border-amber-800/40 bg-amber-900/10' : isBlocked ? 'border-red-800/30 bg-red-900/10' : 'border-border-subtle bg-bg-elevated/50'}`}>
                      <div className="text-[11px] font-mono text-text-muted mb-2 uppercase tracking-wider">{u.label}</div>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-lg font-heading font-bold text-text-primary">{u.used}</span>
                        <span className="text-xs text-text-muted font-mono">
                          / {isUnlimited ? '∞' : isBlocked ? '0' : u.limit}
                        </span>
                      </div>
                      {!isUnlimited && !isBlocked && (
                        <div className="h-1.5 rounded-full bg-bg-primary overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-accent-cyan'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      {isUnlimited && <div className="text-[10px] text-purple-400 font-mono">Unlimited</div>}
                      {isBlocked && <div className="text-[10px] text-red-400 font-mono">Pro only</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {Object.entries(PLAN_FEATURES).map(([planId, info]) => {
              const colors = COLOR_MAP[info.color]
              const isCurrent = currentPlan === planId
              const price = plans?.[planId]?.price ?? FALLBACK_PRICES[planId]

              return (
                <div
                  key={planId}
                  className={`relative rounded-2xl border ${colors.border} ${colors.bg} ${colors.glow} p-6 flex flex-col transition-all`}
                >
                  {info.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-accent-cyan text-bg-primary text-xs font-heading font-bold tracking-wide">
                      MOST POPULAR
                    </div>
                  )}

                  <div className="mb-5">
                    <h3 className={`text-lg font-heading font-bold ${colors.accent} mb-1 capitalize`}>
                      {planId}
                    </h3>
                    <p className="text-text-muted text-xs">{info.tagline}</p>
                  </div>

                  <div className="mb-6">
                    {price ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-heading font-bold text-text-primary">₹{price}</span>
                        <span className="text-text-muted text-sm font-mono">/month</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-heading font-bold text-text-primary">Free</span>
                        <span className="text-text-muted text-sm font-mono">forever</span>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {info.highlights.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <svg className={`w-4 h-4 mt-0.5 shrink-0 ${i === 0 && planId !== 'free' ? 'text-text-muted' : colors.accent}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        <span className={`${i === 0 && planId !== 'free' ? 'text-text-muted text-xs' : 'text-text-secondary'}`}>
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => !isCurrent && planId !== 'free' && handleUpgrade(planId)}
                    disabled={isCurrent || planId === 'free' || checkoutLoading === planId}
                    className={`w-full py-3 rounded-xl text-sm font-heading font-bold transition-all ${
                      isCurrent
                        ? 'bg-gray-700/50 text-gray-400 cursor-default border border-gray-600'
                        : colors.btn
                    }`}
                  >
                    {checkoutLoading === planId ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : isCurrent ? 'Current Plan' : info.cta}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Payment methods */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-xl bg-bg-card/50 border border-border-subtle">
              <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Pay with</span>
              <div className="flex items-center gap-2.5 text-text-secondary text-xs font-medium">
                <span className="px-2 py-0.5 rounded bg-green-900/20 text-green-400 border border-green-800/30">UPI</span>
                <span className="px-2 py-0.5 rounded bg-blue-900/20 text-blue-400 border border-blue-800/30">Cards</span>
                <span className="px-2 py-0.5 rounded bg-purple-900/20 text-purple-400 border border-purple-800/30">NetBanking</span>
                <span className="px-2 py-0.5 rounded bg-orange-900/20 text-orange-400 border border-orange-800/30">Wallets</span>
              </div>
            </div>
          </div>

          {/* FAQ / Bottom */}
          <div className="text-center border-t border-border-subtle pt-8">
            <p className="text-text-muted text-xs font-mono mb-2">
              All plans include full access to analytics, charts, and data exports.
            </p>
            <p className="text-text-muted text-xs font-mono">
              AI features powered by Gemini. Usage resets daily at midnight UTC. Payments secured by Razorpay.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
