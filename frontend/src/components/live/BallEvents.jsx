import React, { useState, useEffect, useRef, useMemo } from 'react'
import PlayerAvatar from '../ui/PlayerAvatar'

/* ══════════════════════════════════════════════════════════════
   Ball-by-ball event detection, notifications, confetti,
   and over-progress tile for live IPL matches.
   ══════════════════════════════════════════════════════════════ */

// ── Helpers ──────────────────────────────────────────────────

function batsmenSnapshot(scorecard) {
  const map = {}
  for (const inn of scorecard?.scorecard || []) {
    for (const b of inn.batsmen || inn.batting || []) {
      const n = (b.name || b.fullName || '').trim()
      if (n) map[n] = {
        runs: +b.runs || 0, balls: +b.balls || 0,
        fours: +b.fours || 0, sixes: +b.sixes || 0,
        sr: +b.sr || 0, image: b.image || '', active: !!b.active,
      }
    }
  }
  return map
}

function bowlersSnapshot(scorecard) {
  const map = {}
  for (const inn of scorecard?.scorecard || []) {
    for (const b of inn.bowlers || inn.bowling || []) {
      const n = (b.name || b.fullName || '').trim()
      if (n) map[n] = {
        overs: +b.overs || 0, wickets: +b.wickets || 0,
        runs: +b.runs || 0, economy: +b.economy || 0,
        image: b.image || '', active: !!b.active,
      }
    }
  }
  return map
}

function activeInningsScore(scorecard) {
  const scores = scorecard?.score || []
  for (let i = scores.length - 1; i >= 0; i--) {
    if (parseFloat(scores[i].o || 0) > 0) return scores[i]
  }
  return scores[scores.length - 1] || null
}

function parseOvers(o) {
  const v = parseFloat(o) || 0
  const comp = Math.floor(v)
  const balls = Math.round((v - comp) * 10)
  return { comp, balls, total: comp * 6 + balls }
}


// ── useBallEvents Hook ──────────────────────────────────────

export function useBallEvents(scorecard, isLive) {
  const prevRef = useRef(null)
  const [notifications, setNotifications] = useState([])
  const [overBalls, setOverBalls] = useState([])
  // overComp = completed overs (e.g. 4 when score reads 4.2).
  // Ball labels become 4.1 … 4.6, display title = "Over 5".
  const [overComp, setOverComp] = useState(0)
  const idRef = useRef(0)

  useEffect(() => {
    if (!isLive || !scorecard?.scorecard?.length) {
      prevRef.current = null
      return
    }

    const bs = scorecard.ballState
    const fromServer = bs != null && typeof bs.overComp === 'number'
    if (fromServer) {
      setOverComp(bs.overComp)
      setOverBalls((bs.balls || []).map(b => ({ ...b, isNew: false })))
    }

    const currScore = activeInningsScore(scorecard)
    const currBat = batsmenSnapshot(scorecard)
    const currBowl = bowlersSnapshot(scorecard)

    const prev = prevRef.current
    prevRef.current = { score: currScore ? { ...currScore } : null, bat: { ...currBat }, bowl: { ...currBowl } }

    if (!prev || !prev.score) {
      if (!fromServer && currScore) {
        const o = parseOvers(currScore.o)
        setOverComp(o.comp)
      }
      return
    }
    if (!currScore) return

    const prevO = parseOvers(prev.score.o)
    const currO = parseOvers(currScore.o)
    const dR = (+currScore.r || 0) - (+prev.score.r || 0)
    const dW = (+currScore.w || 0) - (+prev.score.w || 0)

    if (prevO.total === currO.total && dR === 0 && dW === 0) return

    const newOverStarted = currO.comp > prevO.comp
    if (!fromServer) {
      setOverComp(currO.comp)
    }

    let result = String(Math.max(dR, 0))
    let type = 'run'
    let evBatter = null
    let evBowler = null
    const newLegalBalls = currO.total - prevO.total

    for (const [name, c] of Object.entries(currBat)) {
      const p = prev.bat[name]
      if (!p) continue
      if (c.sixes > p.sixes) { result = '6'; type = 'six'; evBatter = { name, ...c }; break }
      if (c.fours > p.fours) { result = '4'; type = 'four'; evBatter = { name, ...c }; break }
    }

    if (dW > 0) {
      result = 'W'; type = 'wicket'
      for (const [name, c] of Object.entries(currBowl)) {
        const p = prev.bowl[name]
        if (p && c.wickets > p.wickets) { evBowler = { name, ...c }; break }
      }
    }

    const isExtra = newLegalBalls === 0 && dR > 0

    if (!fromServer) {
      if (newOverStarted && currO.balls === 0) {
        setOverBalls([])
      } else if (newLegalBalls > 0 || isExtra) {
        const ball = {
          ballNum: currO.balls,
          overComp: currO.comp,
          result: isExtra ? `+${dR}` : result,
          type: isExtra ? 'extra' : type,
          runs: dR,
          isNew: true,
        }
        setOverBalls(prev => {
          if (newOverStarted) return [ball]
          return [...prev.filter(b => b.overComp === currO.comp), ball]
        })
      } else if (newOverStarted) {
        setOverBalls([])
      }
    }

    // ─ Generate notifications ─
    const notifs = []
    const ts = Date.now()

    if (type === 'four' && evBatter) notifs.push({ id: ++idRef.current, type: 'FOUR', player: evBatter.name, image: evBatter.image, runs: evBatter.runs, balls: evBatter.balls, ts })
    if (type === 'six' && evBatter) notifs.push({ id: ++idRef.current, type: 'SIX', player: evBatter.name, image: evBatter.image, runs: evBatter.runs, balls: evBatter.balls, ts })
    if (dW > 0 && evBowler) notifs.push({ id: ++idRef.current, type: 'WICKET', player: evBowler.name, image: evBowler.image, wickets: evBowler.wickets, ts })

    for (const [name, c] of Object.entries(currBat)) {
      const p = prev.bat[name]
      if (!p) continue
      if (p.runs < 50 && c.runs >= 50 && c.runs < 100) notifs.push({ id: ++idRef.current, type: 'FIFTY', player: name, image: c.image, runs: c.runs, balls: c.balls, ts })
      if (p.runs < 100 && c.runs >= 100) notifs.push({ id: ++idRef.current, type: 'CENTURY', player: name, image: c.image, runs: c.runs, balls: c.balls, ts })
    }

    if (notifs.length) setNotifications(n => [...n, ...notifs])
  }, [scorecard, isLive])

  // Auto-dismiss after 5s
  useEffect(() => {
    if (!notifications.length) return
    const t = setInterval(() => setNotifications(n => n.filter(e => Date.now() - e.ts < 5500)), 600)
    return () => clearInterval(t)
  }, [notifications.length])

  // Clear isNew flag after animation plays
  useEffect(() => {
    if (!overBalls.some(b => b.isNew)) return
    const t = setTimeout(() => setOverBalls(b => b.map(x => ({ ...x, isNew: false }))), 600)
    return () => clearTimeout(t)
  }, [overBalls])

  return { notifications, overBalls, overComp }
}


// ── Over Progress Tile ──────────────────────────────────────

function ballColor(result) {
  switch (result) {
    case '4': return { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', glow: '0 0 14px rgba(52,211,153,0.35)' }
    case '6': return { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', glow: '0 0 14px rgba(245,158,11,0.4)' }
    case 'W': return { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400', glow: '0 0 14px rgba(239,68,68,0.35)' }
    case '0': return { bg: 'bg-white/[0.04]', border: 'border-white/[0.1]', text: 'text-text-muted', glow: 'none' }
    default:  return { bg: 'bg-white/[0.08]', border: 'border-white/[0.18]', text: 'text-text-primary', glow: 'none' }
  }
}

export function OverProgressTile({ balls, overComp, maxOvers = 20 }) {
  if (overComp == null) return null

  const displayOver = overComp + 1
  if (displayOver > maxOvers) return null
  const legalBalls = balls.filter(b => b.type !== 'extra')
  const extras = balls.filter(b => b.type === 'extra')
  const totalRuns = balls.reduce((s, b) => s + (b.runs || 0), 0)

  const slots = Array.from({ length: 6 }, (_, i) => {
    const pos = i + 1
    return legalBalls.find(b => b.ballNum === pos) || null
  })

  const nextPos = slots.findIndex(s => s === null)
  const filledCount = slots.filter(Boolean).length

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-card overflow-hidden">
      <div className="px-3 py-3 sm:px-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex flex-row sm:contents items-center gap-3 sm:gap-4">
          <div className="flex-shrink-0 text-center min-w-[48px] sm:min-w-[52px]">
            <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Over</p>
            <p className="text-2xl font-black text-text-primary font-mono leading-none mt-0.5">{displayOver}</p>
          </div>

          <div className="hidden sm:block h-10 w-px bg-border-subtle flex-shrink-0" />
        </div>

        <div className="flex-1 flex items-center min-w-0 w-full">
          <div className="relative w-full min-w-0 py-1">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/[0.04] -translate-y-1/2 rounded-full" />
            <div
              className="absolute top-1/2 left-0 h-0.5 bg-accent-cyan/20 -translate-y-1/2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((filledCount / 6) * 100, 100)}%` }}
            />

            <div className="relative flex flex-nowrap items-center justify-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {slots.map((ball, i) => {
                const c = ball ? ballColor(ball.result) : null
                const isNext = !ball && i === nextPos && nextPos < 6
                const label = `${overComp}.${i + 1}`
                return (
                  <div key={i} className="flex flex-col items-center gap-1 z-10 flex-shrink-0 w-[2.25rem] sm:w-11">
                    <div
                      className={`
                        w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center
                        text-xs sm:text-sm font-bold border-2 transition-all duration-300
                        ${ball
                          ? `${c.bg} ${c.border} ${c.text} ${ball.isNew ? 'animate-ball-pop' : ''}`
                          : isNext
                            ? 'bg-accent-cyan/5 border-accent-cyan/30 text-accent-cyan/40 animate-ball-pulse'
                            : 'bg-white/[0.02] border-white/[0.05] text-white/[0.08]'
                        }
                      `}
                      style={ball ? { boxShadow: c.glow } : {}}
                    >
                      {ball ? (
                        <span className={ball.isNew ? 'animate-ball-travel' : ''}>{ball.result}</span>
                      ) : (
                        <span className="text-[10px] sm:text-xs">•</span>
                      )}
                    </div>
                    <span className={`text-[8px] sm:text-[9px] font-mono text-center w-full truncate ${ball ? 'text-text-secondary' : 'text-text-muted/50'}`}>{label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex w-full flex-row flex-wrap items-center justify-center gap-4 pt-3 border-t border-border-subtle/40 sm:w-auto sm:contents sm:border-0 sm:pt-0 sm:gap-4">
          {extras.length > 0 && (
            <>
              <div className="hidden sm:block h-8 w-px bg-border-subtle flex-shrink-0" />
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <div className="flex gap-1 flex-wrap justify-center max-w-[5rem]">
                  {extras.map((e, i) => (
                    <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan animate-ball-pop">
                      {e.result}
                    </div>
                  ))}
                </div>
                <span className="text-[8px] text-text-muted uppercase tracking-wider">Extras</span>
              </div>
            </>
          )}

          <div className="hidden sm:block h-10 w-px bg-border-subtle flex-shrink-0" />

          <div className="flex-shrink-0 text-center min-w-[44px]">
            <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Runs</p>
            <p className={`text-2xl font-black font-mono leading-none mt-0.5 ${
              totalRuns >= 15 ? 'text-accent-amber' : totalRuns >= 8 ? 'text-accent-cyan' : 'text-text-primary'
            }`}>{totalRuns}</p>
          </div>
        </div>
      </div>
    </div>
  )
}


// ── Confetti Effect ─────────────────────────────────────────

const CONFETTI_PALETTES = {
  FOUR:    ['#34D399', '#10B981', '#6EE7B7', '#A7F3D0', '#059669'],
  SIX:     ['#F59E0B', '#FBBF24', '#FCD34D', '#D97706', '#FDE68A'],
  WICKET:  ['#EF4444', '#F87171', '#FCA5A5', '#DC2626', '#FF6B6B'],
  FIFTY:   ['#FCD34D', '#FBBF24', '#F59E0B', '#FFE066', '#D97706'],
  CENTURY: ['#FDE047', '#FACC15', '#EAB308', '#FFD700', '#FFC107', '#F59E0B', '#FF69B4', '#00E5FF'],
}

function ConfettiExplosion({ type = 'FIFTY' }) {
  const particles = useMemo(() => {
    const palette = CONFETTI_PALETTES[type] || CONFETTI_PALETTES.FIFTY
    const count = type === 'CENTURY' ? 60 : type === 'FIFTY' ? 45 : 30
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      color: palette[Math.floor(Math.random() * palette.length)],
      size: 4 + Math.random() * 7,
      delay: Math.random() * 0.6,
      duration: 1.2 + Math.random() * 1.8,
      drift: (Math.random() - 0.5) * 120,
      yDist: 150 + Math.random() * 200,
      isCircle: Math.random() > 0.5,
    }))
  }, [type])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: '-8px',
            width: `${p.size}px`,
            height: `${p.size * (p.isCircle ? 1 : 0.6)}px`,
            backgroundColor: p.color,
            borderRadius: p.isCircle ? '50%' : '1px',
            animation: `confettiFall ${p.duration}s ease-out ${p.delay}s forwards`,
            '--confetti-drift': `${p.drift}px`,
            '--confetti-y': `${p.yDist}px`,
            opacity: 0,
            animationFillMode: 'forwards',
          }}
        />
      ))}
    </div>
  )
}


// ── Full-screen Confetti Overlay (for milestones) ───────────

export function MilestoneConfettiOverlay({ type }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3500)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      <ConfettiExplosion type={type} />
    </div>
  )
}


// ── Event Notification Cards ────────────────────────────────

const EVT = {
  FOUR:    { label: 'FOUR!',           icon: '4',  grad: 'from-emerald-600/25 via-emerald-500/15 to-emerald-900/5',  border: 'border-emerald-500/40', text: 'text-emerald-400', badge: 'bg-emerald-500 text-black' },
  SIX:     { label: 'SIX!',            icon: '6',  grad: 'from-amber-600/25 via-amber-500/15 to-purple-900/5',      border: 'border-amber-500/40',   text: 'text-amber-400',   badge: 'bg-amber-500 text-black' },
  WICKET:  { label: 'WICKET!',         icon: 'W',  grad: 'from-red-600/25 via-red-500/15 to-red-900/5',             border: 'border-red-500/40',     text: 'text-red-400',     badge: 'bg-red-500 text-white' },
  FIFTY:   { label: 'HALF CENTURY!',   icon: '50', grad: 'from-yellow-500/25 via-amber-400/15 to-amber-900/5',      border: 'border-yellow-400/50',  text: 'text-yellow-300',  badge: 'bg-yellow-400 text-black' },
  CENTURY: { label: 'CENTURY!',        icon: '💯', grad: 'from-yellow-400/30 via-amber-300/20 to-amber-800/5',      border: 'border-yellow-300/60',  text: 'text-yellow-200',  badge: 'bg-yellow-300 text-black' },
}

function EventNotificationCard({ event }) {
  const cfg = EVT[event.type] || EVT.FOUR
  const isMilestone = event.type === 'FIFTY' || event.type === 'CENTURY'

  return (
    <div className={`
      rounded-xl border ${cfg.border}
      bg-gradient-to-r ${cfg.grad} overflow-hidden relative
      animate-slide-in-right
    `}>
      {/* Flash overlay */}
      <div className={`absolute inset-0 ${
        event.type === 'SIX' ? 'bg-amber-500/20' :
        event.type === 'FOUR' ? 'bg-emerald-500/15' :
        event.type === 'WICKET' ? 'bg-red-500/15' :
        'bg-yellow-400/20'
      } animate-event-flash`} />

      {isMilestone && <ConfettiExplosion type={event.type} />}

      <div className="relative px-3.5 py-2.5 flex items-center gap-3">
        {/* Player avatar with badge */}
        <div className={`relative flex-shrink-0 ${isMilestone ? 'animate-milestone-bounce' : 'animate-avatar-pop'}`}>
          <PlayerAvatar
            name={event.player}
            imageUrl={event.image || undefined}
            size={46}
            showBorder
          />
          <div className={`absolute -bottom-1 -right-1 min-w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-black px-0.5 ${cfg.badge} shadow-lg`}>
            {cfg.icon}
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-black ${cfg.text} tracking-wider leading-tight`}>
              {cfg.label}
            </p>
            <p className="text-sm font-bold text-text-primary truncate">{event.player}</p>
          </div>
          {event.runs !== undefined && (
            <p className="text-xs text-text-secondary font-mono">
              {event.runs}* ({event.balls} balls)
            </p>
          )}
          {event.wickets !== undefined && (
            <p className="text-xs text-text-secondary font-mono">
              {event.wickets} wicket{event.wickets !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Watermark */}
        <div className={`absolute top-1 right-3 text-3xl font-black ${cfg.text} opacity-[0.07] select-none`}>
          {event.type === 'CENTURY' ? '100' : event.type === 'FIFTY' ? '50' : cfg.icon}
        </div>
      </div>
    </div>
  )
}

export function BallEventNotifications({ notifications }) {
  const [milestoneType, setMilestoneType] = useState(null)

  useEffect(() => {
    const milestone = notifications.find(n => n.type === 'FIFTY' || n.type === 'CENTURY')
    if (milestone) {
      setMilestoneType(milestone.type)
      const t = setTimeout(() => setMilestoneType(null), 3500)
      return () => clearTimeout(t)
    }
  }, [notifications])

  if (!notifications.length && !milestoneType) return null

  return (
    <>
      {milestoneType && <MilestoneConfettiOverlay type={milestoneType} />}

      {notifications.length > 0 && (
        <div className="flex flex-col gap-2">
          {notifications.slice(0, 3).map(n => (
            <EventNotificationCard key={n.id} event={n} />
          ))}
        </div>
      )}
    </>
  )
}
