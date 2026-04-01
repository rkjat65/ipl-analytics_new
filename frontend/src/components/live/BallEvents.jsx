import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import PlayerAvatar from '../ui/PlayerAvatar'
import { getLiveBalls } from '../../lib/api'

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
    if (parseFloat(scores[i].o || 0) > 0) return { ...scores[i], _inningsIdx: i }
  }
  const last = scores[scores.length - 1] || null
  return last ? { ...last, _inningsIdx: scores.length - 1 } : null
}

function parseOvers(o) {
  const v = parseFloat(o) || 0
  const comp = Math.floor(v)
  const balls = Math.round((v - comp) * 10)
  return { comp, balls, total: comp * 6 + balls }
}


// ── useBallEvents Hook ──────────────────────────────────────

const BALL_POLL_INTERVAL = 3000

export function useBallEvents(scorecard, isLive, matchId) {
  const prevRef = useRef(null)
  const [notifications, setNotifications] = useState([])
  const [overBalls, setOverBalls] = useState([])
  const [overComp, setOverComp] = useState(0)
  const [previousOver, setPreviousOver] = useState(null)
  const [allOvers, setAllOvers] = useState([])
  const [currentInnings, setCurrentInnings] = useState(1)
  const [serverSynced, setServerSynced] = useState(false)
  const idRef = useRef(0)
  const ballPollRef = useRef(null)
  const prevBallCountRef = useRef(0)

  const fetchBalls = useCallback(() => {
    if (!matchId) return
    getLiveBalls(matchId)
      .then(data => {
        if (!data || !data.synced) {
          setServerSynced(false)
          return
        }
        setServerSynced(true)
        setAllOvers(data.allOvers || [])
        if (data.currentInnings) setCurrentInnings(data.currentInnings)

        if (data.currentOver) {
          const co = data.currentOver
          setOverComp(co.overNumber)
          const isNewData = data.totalBalls !== prevBallCountRef.current
          prevBallCountRef.current = data.totalBalls
          setOverBalls(co.balls.map(b => ({ ...b, isNew: isNewData && b === co.balls[co.balls.length - 1] })))
        }
        if (data.previousOver) {
          setPreviousOver(data.previousOver)
        }
      })
      .catch(() => {
        setServerSynced(false)
      })
  }, [matchId])

  useEffect(() => {
    if (!matchId) return
    fetchBalls()
    if (isLive) {
      ballPollRef.current = setInterval(fetchBalls, BALL_POLL_INTERVAL)
      return () => clearInterval(ballPollRef.current)
    }
  }, [fetchBalls, isLive, matchId])

  // Client-side diff for notifications + fallback ball display
  useEffect(() => {
    if (!isLive || !scorecard?.scorecard?.length) {
      prevRef.current = null
      return
    }

    const currScore = activeInningsScore(scorecard)
    const currBat = batsmenSnapshot(scorecard)
    const currBowl = bowlersSnapshot(scorecard)
    const prev = prevRef.current

    const inningsChanged = prev?.score && currScore &&
      prev.score._inningsIdx !== currScore._inningsIdx

    if (inningsChanged) {
      prevRef.current = { score: currScore ? { ...currScore } : null, bat: { ...currBat }, bowl: { ...currBowl } }
      if (!serverSynced) {
        setOverBalls([])
        setOverComp(0)
      }
      return
    }

    if (serverSynced) {
      prevRef.current = { score: currScore ? { ...currScore } : null, bat: { ...currBat }, bowl: { ...currBowl } }
      if (!prev || !prev.score || !currScore) return

      const prevO = parseOvers(prev.score.o)
      const currO = parseOvers(currScore.o)
      const dR = (+currScore.r || 0) - (+prev.score.r || 0)
      const dW = (+currScore.w || 0) - (+prev.score.w || 0)
      if (prevO.total === currO.total && dR === 0 && dW === 0) return

      _emitNotifications(prev, currBat, currBowl, dW, dR, currO, prevO, idRef, setNotifications)
      return
    }

    // Full client-side fallback (no server ball data)
    prevRef.current = { score: currScore ? { ...currScore } : null, bat: { ...currBat }, bowl: { ...currBowl } }

    if (!prev || !prev.score) {
      if (currScore) {
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

    if (currO.total < prevO.total) {
      setOverBalls([])
      setOverComp(0)
      return
    }

    const newOverStarted = currO.comp > prevO.comp
    setOverComp(currO.comp)

    let result = String(Math.max(dR, 0))
    let type = 'run'
    const newLegalBalls = currO.total - prevO.total

    for (const [name, c] of Object.entries(currBat)) {
      const p = prev.bat[name]
      if (!p) continue
      if (c.sixes > p.sixes) { result = '6'; type = 'six'; break }
      if (c.fours > p.fours) { result = '4'; type = 'four'; break }
    }

    if (dW > 0) { result = 'W'; type = 'wicket' }

    const isExtra = newLegalBalls === 0 && dR > 0

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

    _emitNotifications(prev, currBat, currBowl, dW, dR, currO, prevO, idRef, setNotifications)
  }, [scorecard, isLive, serverSynced])

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

  return { notifications, overBalls, overComp, previousOver, allOvers, currentInnings, serverSynced }
}

function _emitNotifications(prev, currBat, currBowl, dW, dR, currO, prevO, idRef, setNotifications) {
  const notifs = []
  const ts = Date.now()
  let evBatter = null
  let evBowler = null
  let type = 'run'

  for (const [name, c] of Object.entries(currBat)) {
    const p = prev.bat[name]
    if (!p) continue
    if (c.sixes > p.sixes) { type = 'six'; evBatter = { name, ...c }; break }
    if (c.fours > p.fours) { type = 'four'; evBatter = { name, ...c }; break }
  }

  if (dW > 0) {
    type = 'wicket'
    for (const [name, c] of Object.entries(currBowl)) {
      const p = prev.bowl[name]
      if (p && c.wickets > p.wickets) { evBowler = { name, ...c }; break }
    }
  }

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
  const totalRuns = balls.reduce((s, b) => s + (b.runs || 0), 0)

  const allBalls = useMemo(() => {
    const slots = []
    let legalIdx = 0

    for (const b of balls) {
      if (b.type === 'extra') {
        slots.push({ ...b, slotLabel: null })
      } else {
        legalIdx++
        slots.push({ ...b, slotLabel: `${overComp}.${legalIdx}` })
      }
    }

    const filledLegal = legalIdx
    for (let i = filledLegal + 1; i <= 6; i++) {
      slots.push({ empty: true, slotLabel: `${overComp}.${i}`, isNext: i === filledLegal + 1 })
    }
    return slots
  }, [balls, overComp])

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-card overflow-hidden">
      <div className="px-3 pt-2.5 pb-1 sm:px-4 flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Over</span>
          <span className="text-lg font-black text-text-primary font-mono leading-none">{displayOver}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Runs</span>
          <span className={`text-lg font-black font-mono leading-none ${
            totalRuns >= 15 ? 'text-accent-amber' : totalRuns >= 8 ? 'text-accent-cyan' : 'text-text-primary'
          }`}>{totalRuns}</span>
        </div>
      </div>

      <div className="px-3 pb-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {allBalls.map((ball, i) => {
            if (ball.empty) {
              return (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div className={`
                    w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center
                    text-[11px] sm:text-sm font-bold border-2 transition-all duration-300
                    ${ball.isNext
                      ? 'bg-accent-cyan/5 border-accent-cyan/30 text-accent-cyan/40 animate-ball-pulse'
                      : 'bg-white/[0.02] border-white/[0.05] text-white/[0.08]'
                    }
                  `}>
                    <span className="text-[10px] sm:text-xs">•</span>
                  </div>
                  <span className="text-[7px] sm:text-[9px] font-mono text-text-muted/50">{ball.slotLabel}</span>
                </div>
              )
            }

            const isExtra = ball.type === 'extra'
            const c = ballColor(ball.result)
            return (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div
                  className={`
                    w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center
                    text-[11px] sm:text-sm font-bold border-2 transition-all duration-300
                    ${isExtra
                      ? 'border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan'
                      : `${c.bg} ${c.border} ${c.text}`
                    }
                    ${ball.isNew ? 'animate-ball-pop' : ''}
                  `}
                  style={!isExtra ? { boxShadow: c.glow } : {}}
                >
                  <span className={ball.isNew ? 'animate-ball-travel' : ''}>{ball.result}</span>
                </div>
                {ball.slotLabel ? (
                  <span className="text-[7px] sm:text-[9px] font-mono text-text-secondary">{ball.slotLabel}</span>
                ) : (
                  <span className="text-[7px] sm:text-[8px] font-mono text-accent-cyan/50">ext</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


// ── Previous Overs Accordion ────────────────────────────────

function SmallBallChip({ result }) {
  const c = ballColor(result)
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-[10px] sm:text-[11px] font-bold border ${c.border} ${c.bg} ${c.text}`}
      style={{ boxShadow: c.glow !== 'none' ? c.glow.replace('14px', '8px') : 'none' }}
    >
      {result}
    </span>
  )
}

function InningsAccordion({ teamName, overs, defaultOpen = false, isComplete = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const sorted = useMemo(() => [...overs].sort((a, b) => b.overNumber - a.overNumber), [overs])

  if (!sorted.length) return null

  const title = isComplete
    ? (teamName ? `${teamName} Over-by-Over` : 'Over-by-Over')
    : (teamName ? `${teamName} Previous Overs` : 'Previous Overs')

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2.5 sm:px-4 flex items-center justify-between gap-2 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">
            {title}
          </span>
          <span className="text-[10px] font-mono text-text-muted/60">
            ({sorted.length})
          </span>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`w-4 h-4 text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-border-subtle divide-y divide-border-subtle/50">
          {sorted.map(ov => {
            const balls = ov.balls || []
            return (
              <div key={ov.overNumber} className="px-3 py-2 sm:px-4 flex items-center gap-3">
                <div className="flex-shrink-0 w-10 sm:w-12 text-center">
                  <span className="text-xs font-black text-text-secondary font-mono">
                    {ov.overNumber + 1}
                  </span>
                </div>

                <div className="flex-1 flex items-center justify-center gap-1 min-w-0 flex-wrap">
                  {balls.map((b, i) => (
                    <SmallBallChip key={i} result={b.result} />
                  ))}
                </div>

                <div className="flex-shrink-0 text-right min-w-[32px]">
                  <span className={`text-sm font-black font-mono ${
                    ov.runs >= 15 ? 'text-accent-amber' : ov.runs >= 8 ? 'text-accent-cyan' : 'text-text-primary'
                  }`}>
                    {ov.runs}
                  </span>
                  {ov.wickets > 0 && (
                    <span className="text-[9px] font-mono text-red-400 ml-0.5">/{ov.wickets}w</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function PreviousOversAccordion({ allOvers, currentOverNumber, currentInnings, inningsComplete = false, matchComplete = false }) {
  const inningsGroups = useMemo(() => {
    if (!allOvers?.length) return []
    const groups = {}
    for (const ov of allOvers) {
      const inn = ov.innings || 1
      const isLiveOver = !inningsComplete && !matchComplete && inn === currentInnings && ov.overNumber === currentOverNumber
      if (isLiveOver) continue
      if (!groups[inn]) groups[inn] = { innings: inn, team: ov.battingTeam || '', overs: [] }
      groups[inn].overs.push(ov)
    }
    return Object.values(groups).sort((a, b) => b.innings - a.innings)
  }, [allOvers, currentOverNumber, currentInnings, inningsComplete, matchComplete])

  if (!inningsGroups.length) return null

  return (
    <>
      {inningsGroups.map(group => {
        const isGroupComplete = matchComplete || (inningsComplete && group.innings < currentInnings) || (group.innings < currentInnings)
        return (
          <InningsAccordion
            key={group.innings}
            teamName={group.team}
            overs={group.overs}
            defaultOpen={false}
            isComplete={isGroupComplete}
          />
        )
      })}
    </>
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
