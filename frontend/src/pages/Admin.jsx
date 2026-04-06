import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAdminUsers, getAdminStats, runAdminSqlQuery, getLivePollerConfig, startLivePoller, stopLivePoller, setLivePollerInterval, refreshLiveMatches, getAdminLiveMatches, setMatchTracking, deleteBalls, syncBalls } from '../lib/api'
import SEO from '../components/SEO'

function LiveScorePanel({ token }) {
  const [config, setConfig] = useState(null)
  const [matches, setMatches] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')
  const [intervalInput, setIntervalInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [toggling, setToggling] = useState(null)
  const [syncing, setSyncing] = useState(null)

  const loadConfig = useCallback(() => {
    if (!token) return
    getLivePollerConfig(token)
      .then(c => {
        setConfig(c)
        setIntervalInput(String(c.pollIntervalMs))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const loadMatches = useCallback(() => {
    if (!token) return
    getAdminLiveMatches(token)
      .then(res => {
        setMatches(res.matches || [])
        setUpcoming(res.upcoming || [])
      })
      .catch(() => {})
  }, [token])

  useEffect(() => { loadConfig(); loadMatches() }, [loadConfig, loadMatches])

  useEffect(() => {
    if (!actionMsg) return
    const t = setTimeout(() => setActionMsg(''), 4000)
    return () => clearTimeout(t)
  }, [actionMsg])

  const act = async (fn, msg) => {
    setBusy(true)
    try {
      const res = await fn()
      setActionMsg(res.detail || msg)
      loadConfig()
    } catch (err) { setActionMsg(err.message) }
    finally { setBusy(false) }
  }

  const handleInterval = () => {
    const ms = parseInt(intervalInput, 10)
    if (!ms || ms < 0) { setActionMsg('Enter a valid number'); return }
    act(() => setLivePollerInterval(token, ms), 'Interval updated')
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await refreshLiveMatches(token)
      setActionMsg(res.detail || 'Match list refreshed')
      loadMatches()
    } catch (err) { setActionMsg(err.message) }
    finally { setRefreshing(false) }
  }

  const handleToggle = async (matchId, currentlyTracked) => {
    setToggling(matchId)
    try {
      await setMatchTracking(token, matchId, !currentlyTracked)
      loadMatches()
    } catch {}
    finally { setToggling(null) }
  }

  const handleReset = async (matchId) => {
    setToggling(matchId)
    try {
      await setMatchTracking(token, matchId, null)
      loadMatches()
    } catch {}
    finally { setToggling(null) }
  }

  const handleSyncBalls = async (matchId) => {
    setSyncing(matchId)
    try {
      await deleteBalls(token, matchId)
      const res = await syncBalls(token, matchId)
      setActionMsg(res.detail || `Synced ${res.ballCount} balls (fresh)`)
      loadMatches()
    } catch (err) { setActionMsg(err.message) }
    finally { setSyncing(null) }
  }

  if (loading || !config) return null

  const isActive = config.running && !config.paused
  const tracked = matches.filter(m => m.effectivelyTracked)
  const iplMatches = matches.filter(m => m.isIPL)
  const otherMatches = matches.filter(m => !m.isIPL)

  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-magenta/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-accent-magenta">
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h2 className="font-heading font-bold text-text-primary text-sm">Live Score Poller</h2>
            <p className="text-[10px] text-text-muted font-mono">
              Background API polling controls
              {tracked.length > 0 && ` · ${tracked.length} match(es) tracked`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : config.paused ? 'bg-accent-amber' : 'bg-text-muted'}`} />
          <span className={`text-xs font-mono font-semibold ${isActive ? 'text-green-400' : config.paused ? 'text-accent-amber' : 'text-text-muted'}`}>
            {isActive ? 'Active' : config.paused ? 'Paused' : 'Idle'}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Status cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Match Window', value: config.inMatchWindow ? 'Yes' : 'No', color: config.inMatchWindow ? 'text-green-400' : 'text-text-muted' },
            { label: 'API Hits Today', value: config.apiHitsToday, color: 'text-accent-cyan' },
            { label: 'Total Cycles', value: config.totalCycles, color: 'text-accent-lime' },
            { label: 'Errors', value: config.consecutiveErrors, color: config.consecutiveErrors > 0 ? 'text-accent-magenta' : 'text-text-muted' },
          ].map(s => (
            <div key={s.label} className="bg-[#0A0A0F] rounded-lg p-3">
              <div className="text-[9px] text-text-muted font-mono uppercase tracking-wider mb-1">{s.label}</div>
              <div className={`text-xl font-mono font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Info row */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] font-mono text-text-muted">
          <span>Provider: <span className="text-text-secondary">{config.providerName || '—'}</span></span>
          <span>Last poll: <span className="text-text-secondary">{config.lastPollAt ? new Date(config.lastPollAt).toLocaleTimeString() : 'Never'}</span></span>
          {config.nextMatchWindow && (
            <span>Next window: <span className="text-text-secondary">{new Date(config.nextMatchWindow).toLocaleString()}</span></span>
          )}
          {config.lastError && (
            <span>Last error: <span className="text-accent-magenta">{config.lastError}</span></span>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3">
          {config.paused ? (
            <button
              onClick={() => act(() => startLivePoller(token), 'Poller resumed')}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-semibold
                hover:bg-green-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Start Poller
            </button>
          ) : (
            <button
              onClick={() => act(() => stopLivePoller(token), 'Poller paused')}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-accent-amber/20 border border-accent-amber/30 text-accent-amber text-xs font-semibold
                hover:bg-accent-amber/30 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              Pause Poller
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing || busy}
            className="px-4 py-2 rounded-lg bg-accent-magenta/20 border border-accent-magenta/30 text-accent-magenta text-xs font-semibold
              hover:bg-accent-magenta/30 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}>
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {refreshing ? 'Fetching...' : 'Fetch Matches'}
          </button>

          <div className="flex items-end gap-2">
            <div>
              <label className="block text-[9px] text-text-muted font-mono uppercase tracking-wider mb-1">Interval (ms)</label>
              <input
                type="number"
                min="5000"
                max="900000"
                step="1000"
                value={intervalInput}
                onChange={e => setIntervalInput(e.target.value)}
                className="w-28 px-3 py-2 rounded-lg bg-[#0A0A0F] border border-[#1E1E2A] text-text-primary text-xs font-mono
                  focus:outline-none focus:ring-2 focus:ring-accent-cyan/40"
              />
            </div>
            <button
              onClick={handleInterval}
              disabled={busy}
              className="px-3 py-2 rounded-lg bg-surface-hover border border-border-subtle text-text-secondary text-xs font-semibold
                hover:text-text-primary hover:bg-surface-card transition-all disabled:opacity-50"
            >
              Set
            </button>
          </div>
        </div>

        {/* Action message */}
        {actionMsg && (
          <div className="px-3 py-2 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-xs font-mono text-center">
            {actionMsg}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-border-subtle" />

        {/* Match list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-heading font-bold text-text-primary">Match Selection</h3>
            {tracked.length > 0 && (
              <span className="text-[10px] font-mono text-text-muted">
                {tracked.length} tracked — {tracked.length} API hit(s) per cycle
              </span>
            )}
          </div>

          {matches.length === 0 && upcoming.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-text-muted text-sm mb-1">No matches loaded</p>
              <p className="text-text-muted/60 text-xs font-mono">
                Click "Fetch Matches" to load live matches from API (1 hit) + upcoming IPL schedule
              </p>
            </div>
          ) : (
            <>
              {iplMatches.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-mono text-accent-magenta uppercase tracking-wider flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-accent-magenta/20">LIVE</span>
                    IPL Matches ({iplMatches.length})
                  </h4>
                  {iplMatches.map(m => (
                    <MatchRow key={m.matchId} m={m} toggling={toggling} onToggle={handleToggle} onReset={handleReset} syncing={syncing} onSyncBalls={handleSyncBalls} />
                  ))}
                </div>
              )}

              {otherMatches.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                    Other Live Matches ({otherMatches.length})
                  </h4>
                  {otherMatches.map(m => (
                    <MatchRow key={m.matchId} m={m} toggling={toggling} onToggle={handleToggle} onReset={handleReset} syncing={syncing} onSyncBalls={handleSyncBalls} />
                  ))}
                </div>
              )}

              {upcoming.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-mono text-accent-amber uppercase tracking-wider flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-accent-amber/20">SCHEDULE</span>
                    Upcoming IPL Matches ({upcoming.length})
                  </h4>
                  {upcoming.map(u => (
                    <div key={u.match} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-[#0A0A0F] border border-[#1E1E2A]">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${u.status === 'live' ? 'bg-green-400 animate-pulse' : 'bg-accent-amber'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-text-primary font-medium truncate">
                          {u.home} vs {u.away}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-text-muted">
                            Match {u.match}
                          </span>
                          <span className="text-[10px] font-mono text-text-secondary truncate">
                            {new Date(u.dateTimeGMT).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {' · '}
                            {u.time} IST
                          </span>
                          <span className="text-[10px] font-mono text-text-muted truncate hidden sm:inline">
                            {u.venue}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-mono flex-shrink-0 ${u.status === 'live' ? 'text-green-400' : 'text-accent-amber'}`}>
                        {u.status === 'live' ? 'Live' : 'Upcoming'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] font-mono text-text-muted/60">
                Toggle ON to poll scorecard for a match. Each tracked match = 1 API hit per poll cycle. "Fetch Matches" refreshes live matches (1 hit) + shows upcoming schedule (0 hits).
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MatchRow({ m, toggling, onToggle, onReset, syncing, onSyncBalls }) {
  const isOn = m.effectivelyTracked
  const statusColor = m.matchStatus === 'live' ? 'bg-green-400'
    : m.matchStatus === 'upcoming' ? 'bg-accent-amber'
    : 'bg-text-muted'
  const modeLabel = m.trackingMode === 'pinned' ? 'Pinned'
    : m.trackingMode === 'disabled' ? 'Off'
    : 'Auto'
  const modeColor = m.trackingMode === 'pinned' ? 'text-accent-cyan'
    : m.trackingMode === 'disabled' ? 'text-accent-magenta'
    : 'text-text-muted'

  const bs = m.ballSync
  const isSynced = bs?.synced

  return (
    <div className={`flex flex-col gap-1.5 py-2.5 px-3 rounded-lg border transition-colors
      ${isOn ? 'bg-green-500/5 border-green-500/20' : 'bg-[#0A0A0F] border-[#1E1E2A]'}`}>
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor} ${m.matchStatus === 'live' ? 'animate-pulse' : ''}`} />

        <div className="flex-1 min-w-0">
          <div className="text-xs text-text-primary font-medium truncate">
            {m.teams?.length === 2 ? m.teams.join(' vs ') : m.name || m.matchId}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono text-text-muted capitalize">{m.matchStatus}</span>
            {m.status && <span className="text-[10px] font-mono text-text-secondary truncate">{m.status}</span>}
            {m.score?.length > 0 && (
              <span className="text-[10px] font-mono text-accent-lime truncate hidden sm:inline">
                {m.score.map(s => `${s.inning?.split(' ')?.[0] || ''} ${s.r || s.score || ''}`).join(' | ')}
              </span>
            )}
          </div>
        </div>

        <span className={`text-[9px] font-mono flex-shrink-0 ${modeColor}`}>{modeLabel}</span>

        {m.trackingMode !== 'auto' && (
          <button
            onClick={() => onReset(m.matchId)}
            disabled={toggling === m.matchId}
            title="Reset to auto"
            className="text-[10px] text-text-muted hover:text-text-secondary font-mono transition-colors disabled:opacity-50 flex-shrink-0"
          >
            Reset
          </button>
        )}

        <button
          onClick={() => onToggle(m.matchId, isOn)}
          disabled={toggling === m.matchId}
          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 disabled:opacity-50
            ${isOn ? 'bg-green-500/40' : 'bg-[#2A2A3A]'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform
            ${isOn ? 'translate-x-4 bg-green-400' : 'translate-x-0 bg-text-muted'}`} />
        </button>
      </div>

      {/* Ball sync row */}
      {(m.matchStatus === 'live' || m.matchStatus === 'completed' || isSynced) && (
        <div className="flex items-center gap-2 ml-5">
          <button
            onClick={() => onSyncBalls(m.matchId)}
            disabled={syncing === m.matchId}
            className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5
              ${isSynced
                ? 'bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/20'
                : 'bg-accent-amber/10 border border-accent-amber/20 text-accent-amber hover:bg-accent-amber/20'
              }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3 h-3 ${syncing === m.matchId ? 'animate-spin' : ''}`}>
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {syncing === m.matchId ? 'Syncing...' : isSynced ? 'Re-sync Balls' : 'Sync Balls'}
          </button>
          {isSynced && (
            <span className="text-[9px] font-mono text-text-muted">
              {bs.ballCount} balls
              {bs.lastSyncedAt && ` · ${new Date(bs.lastSyncedAt).toLocaleTimeString()}`}
            </span>
          )}
        </div>
      )}
    </div>
  )
}


export default function Admin() {
  const { token } = useAuth()
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetModal, setResetModal] = useState(null) // { userId, email, name }
  const [resetPassword, setResetPassword] = useState('')
  const [resetMsg, setResetMsg] = useState('')
  const [sqlText, setSqlText] = useState('SELECT * FROM matches ORDER BY match_id DESC LIMIT 50')
  const [sqlResult, setSqlResult] = useState([])
  const [sqlColumns, setSqlColumns] = useState([])
  const [sqlLoading, setSqlLoading] = useState(false)
  const [sqlError, setSqlError] = useState(null)
  const [sqlExecuted, setSqlExecuted] = useState(false)
  const [sqlCopied, setSqlCopied] = useState(false)

  const loadData = () => {
    if (!token) { setError('Not authenticated'); setLoading(false); return }
    Promise.all([getAdminUsers(token), getAdminStats(token)])
      .then(([u, s]) => { setUsers(u); setStats(s) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [token])

  const executeSql = async () => {
    if (!sqlText || !sqlText.trim()) {
      setSqlError('Please enter a SQL query.')
      return
    }
    setSqlError(null)
    setSqlLoading(true)
    setSqlExecuted(false)
    setSqlCopied(false)

    try {
      const res = await runAdminSqlQuery(token, sqlText)
      setSqlResult(res.rows || [])
      setSqlColumns(res.columns || [])
      setSqlExecuted(true)
    } catch (err) {
      setSqlError(err.message)
      setSqlResult([])
      setSqlColumns([])
      setSqlExecuted(true)
    } finally {
      setSqlLoading(false)
    }
  }

  const copySqlResult = async () => {
    if (!sqlResult.length || !sqlColumns.length) return

    const lines = [sqlColumns.join('\t')]
    sqlResult.forEach(row => {
      lines.push(sqlColumns.map(column => String(row[column] ?? '')).join('\t'))
    })

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setSqlCopied(true)
      setTimeout(() => setSqlCopied(false), 2000)
    } catch (err) {
      setSqlError('Clipboard copy failed. Please try again.')
    }
  }

  const handleResetPassword = async () => {
    if (!resetPassword || resetPassword.length < 6) {
      setResetMsg('Password must be at least 6 characters')
      return
    }
    try {
      const res = await fetch('/api/auth/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: resetModal.userId, new_password: resetPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      setResetMsg(data.detail)
      setTimeout(() => { setResetModal(null); setResetPassword(''); setResetMsg('') }, 2000)
    } catch (err) {
      setResetMsg(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-heading font-bold text-text-primary mb-2">Access Denied</h2>
          <p className="text-red-400 text-sm">{error}</p>
          <p className="text-text-muted text-xs mt-2">Only the platform admin can access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <SEO
        title="Admin Panel — Crickrida"
        description="Crickrida platform administration: user accounts, live score poller controls, and IPL match tracking. Authorized admin access only."
        url="https://crickrida.rkjat.in/admin"
        keywords="Crickrida admin, platform administration, live score poller"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Admin Panel — Crickrida',
          description: 'Platform administration for Crickrida IPL analytics.',
          url: 'https://crickrida.rkjat.in/admin',
          isPartOf: { '@type': 'WebSite', name: 'Crickrida', url: 'https://crickrida.rkjat.in' },
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-magenta to-accent-amber flex items-center justify-center text-white font-bold text-lg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <h1 className="font-heading font-bold text-text-primary text-xl">Admin Panel</h1>
          <p className="text-xs text-text-muted font-mono">Platform users & analytics</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total Users', value: stats.total_users, color: 'text-accent-cyan' },
            { label: 'Google Users', value: stats.google_users, color: 'text-accent-magenta' },
            { label: 'Email Users', value: stats.email_users, color: 'text-accent-lime' },
            { label: 'Active Sessions', value: stats.active_sessions, color: 'text-accent-amber' },
            { label: 'Today Signups', value: stats.today_signups, color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="bg-bg-card border border-border-subtle rounded-xl p-4">
              <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1">{s.label}</div>
              <div className={`text-3xl font-mono font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* SQL Query Console */}
      <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-text-primary text-sm">SQL Query Console</h2>
            <p className="text-[10px] text-text-muted font-mono">
              Run read-only SQL queries against the historical DuckDB dataset. Results are shown below in table form and can be copied.
            </p>
          </div>
          <span className="text-[10px] font-mono text-text-muted">Admin only</span>
        </div>

        <div className="p-5 space-y-4">
          <textarea
            value={sqlText}
            onChange={e => setSqlText(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full min-h-[170px] rounded-xl bg-[#0A0A0F] border border-[#1E1E2A] px-4 py-3 text-text-primary text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-accent-cyan/40"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={executeSql}
                disabled={sqlLoading}
                className="px-4 py-2 rounded-lg bg-accent-cyan text-black font-semibold text-xs uppercase tracking-wide hover:bg-accent-cyan/90 disabled:opacity-50"
              >
                {sqlLoading ? 'Running…' : 'Run SQL'}
              </button>
              <button
                onClick={copySqlResult}
                disabled={!sqlResult.length || !sqlColumns.length}
                className="px-4 py-2 rounded-lg border border-border-subtle text-text-secondary text-xs uppercase tracking-wide hover:bg-surface-hover disabled:opacity-50"
              >
                {sqlCopied ? 'Copied!' : 'Copy Result'}
              </button>
            </div>
            <div className="text-[11px] font-mono text-text-muted">
              {sqlLoading
                ? 'Executing query...'
                : sqlExecuted
                  ? `${sqlResult.length} row${sqlResult.length === 1 ? '' : 's'} returned`
                  : 'Enter a SELECT or WITH query to preview results.'}
            </div>
          </div>

          {sqlError && (
            <div className="rounded-xl bg-accent-magenta/10 border border-accent-magenta/20 px-4 py-3 text-sm text-accent-magenta font-mono">
              {sqlError}
            </div>
          )}

          {sqlExecuted && !sqlResult.length && !sqlError && (
            <div className="rounded-xl bg-[#0A0A0F] border border-border-subtle px-4 py-3 text-sm text-text-muted font-mono">
              Query executed successfully. No rows returned.
            </div>
          )}

          {sqlResult.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border-subtle bg-[#09090F]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-elevated/50">
                    {sqlColumns.map(column => (
                      <th key={column} className="px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-text-muted">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sqlResult.slice(0, 100).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-border-subtle/50 hover:bg-bg-card-hover transition-colors">
                      {sqlColumns.map(column => (
                        <td key={column} className="px-3 py-2 text-xs text-text-primary font-mono whitespace-pre-wrap">
                          {row[column] === null || row[column] === undefined ? 'NULL' : String(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sqlResult.length > 100 && (
            <div className="text-[10px] font-mono text-text-muted">Showing first 100 rows. Use Copy Result to export the full set.</div>
          )}
        </div>
      </div>

      {/* Live Score Poller + Match Selection */}
      <LiveScorePanel token={token} />

      {/* Users Table */}
      <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
          <h2 className="font-heading font-bold text-text-primary text-sm">
            Registered Users ({users.length})
          </h2>
          <span className="text-[10px] font-mono text-text-muted">Sorted by newest first</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-elevated/50">
                <th className="text-left py-3 px-4 text-text-muted text-[11px] font-mono uppercase tracking-wider">#</th>
                <th className="text-left py-3 px-4 text-text-muted text-[11px] font-mono uppercase tracking-wider">User</th>
                <th className="text-left py-3 px-4 text-text-muted text-[11px] font-mono uppercase tracking-wider">Email</th>
                <th className="text-left py-3 px-4 text-text-muted text-[11px] font-mono uppercase tracking-wider">Provider</th>
                <th className="text-left py-3 px-4 text-text-muted text-[11px] font-mono uppercase tracking-wider">Verified</th>
                <th className="text-left py-3 px-4 text-text-muted text-[11px] font-mono uppercase tracking-wider">Logins</th>
                <th className="text-left py-3 px-4 text-text-muted text-[11px] font-mono uppercase tracking-wider">Last Login</th>
                <th className="text-left py-3 px-4 text-text-muted text-[11px] font-mono uppercase tracking-wider">Sessions</th>
                <th className="text-left py-3 px-4 text-text-muted text-[11px] font-mono uppercase tracking-wider">Joined</th>
                <th className="text-left py-3 px-4 text-text-muted text-[11px] font-mono uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className="border-b border-border-subtle/50 hover:bg-bg-card-hover transition-colors">
                  <td className="py-3 px-4 text-text-muted font-mono text-xs">{i + 1}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt={u.name ? `${u.name} profile photo` : 'User profile photo'}
                          className="w-8 h-8 rounded-full object-cover border border-border-subtle"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-cyan to-accent-magenta flex items-center justify-center text-white text-xs font-bold">
                          {u.name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <span className="text-text-primary font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-text-secondary font-mono text-xs">{u.email}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                      u.auth_provider === 'google'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20'
                    }`}>
                      {u.auth_provider === 'google' && (
                        <svg className="w-3 h-3" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      )}
                      {u.auth_provider}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {u.is_verified ? (
                      <span className="text-green-400 text-xs font-mono">Yes</span>
                    ) : (
                      <span className="text-text-muted text-xs font-mono">No</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs text-accent-cyan">{u.login_count || 0}</span>
                  </td>
                  <td className="py-3 px-4 text-text-muted font-mono text-xs whitespace-nowrap">
                    {u.last_login ? new Date(u.last_login + 'Z').toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    }) : 'Never'}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`font-mono text-xs ${u.active_sessions > 0 ? 'text-accent-lime' : 'text-text-muted'}`}>
                      {u.active_sessions > 0 ? `${u.active_sessions} active` : 'none'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-text-muted font-mono text-xs whitespace-nowrap">
                    {u.created_at ? new Date(u.created_at + 'Z').toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    }) : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => { setResetModal({ userId: u.id, email: u.email, name: u.name }); setResetPassword(''); setResetMsg('') }}
                      className="text-xs text-accent-amber hover:text-accent-amber/80 font-mono transition-colors"
                      title="Reset password"
                    >
                      Reset PW
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="p-12 text-center text-text-muted font-mono text-sm">
            No users registered yet.
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setResetModal(null)}>
          <div className="bg-[#111118] border border-border-subtle rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-heading font-bold text-text-primary text-lg mb-1">Reset Password</h3>
            <p className="text-text-secondary text-sm mb-4">
              Set a new password for <span className="text-accent-cyan font-mono">{resetModal.email}</span>
            </p>

            {resetMsg && (
              <div className={`mb-4 p-2.5 rounded-lg text-sm text-center ${
                resetMsg.includes('reset for') || resetMsg.includes('success')
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-accent-magenta/10 border border-accent-magenta/30 text-accent-magenta'
              }`}>
                {resetMsg}
              </div>
            )}

            <input
              type="password"
              value={resetPassword}
              onChange={e => { setResetPassword(e.target.value); setResetMsg('') }}
              placeholder="New password (min 6 characters)"
              className="w-full px-4 py-2.5 rounded-lg bg-[#0A0A0F] border border-[#1E1E2A] text-text-primary text-sm
                placeholder-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 mb-4"
            />

            <div className="flex gap-3">
              <button onClick={() => setResetModal(null)}
                className="flex-1 py-2 rounded-lg border border-border-subtle text-text-secondary text-sm hover:bg-bg-card-hover transition-colors">
                Cancel
              </button>
              <button onClick={handleResetPassword}
                className="flex-1 py-2 rounded-lg bg-accent-amber text-black font-bold text-sm hover:brightness-110 transition-all">
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
