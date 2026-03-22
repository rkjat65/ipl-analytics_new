import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getBillingUsage, checkFeatureQuota } from '../lib/api'

export function useSubscription() {
  const { token, isAuthenticated } = useAuth()
  const [plan, setPlan] = useState('free')
  const [usage, setUsage] = useState({})
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await getBillingUsage(token)
      setPlan(data.plan)
      setUsage(data.usage)
    } catch {
      // Silently fail — user might not be logged in
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (isAuthenticated) refresh()
  }, [isAuthenticated, refresh])

  const canUse = useCallback(
    (feature) => {
      const u = usage[feature]
      if (!u) return true // Unknown feature, allow
      if (u.limit === -1) return true // Unlimited
      if (u.limit === 0) return false // Not available
      return u.used < u.limit
    },
    [usage]
  )

  const getRemaining = useCallback(
    (feature) => {
      const u = usage[feature]
      if (!u) return null
      if (u.limit === -1) return Infinity
      return Math.max(0, u.limit - u.used)
    },
    [usage]
  )

  const getUsageInfo = useCallback(
    (feature) => {
      return usage[feature] || null
    },
    [usage]
  )

  return {
    plan,
    usage,
    loading,
    refresh,
    canUse,
    getRemaining,
    getUsageInfo,
    isAuthenticated,
    isPro: plan === 'pro' || plan === 'ultimate',
    isUltimate: plan === 'ultimate',
  }
}
