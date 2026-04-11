import { useEffect, useMemo, useRef, useState } from 'react'

const SPEED_OPTIONS = [
  { value: 0.75, label: '0.75×' },
  { value: 1, label: '1×' },
  { value: 1.5, label: '1.5×' },
  { value: 2, label: '2×' },
]

export function usePresentationDeck(totalSlides = 0, options = {}) {
  const {
    autoStart = true,
    initialSpeed = 1,
    baseDelay = 1000,
  } = options

  const [speed, setSpeed] = useState(initialSpeed)
  const [visibleCount, setVisibleCount] = useState(autoStart ? 0 : totalSlides)
  const [isPlaying, setIsPlaying] = useState(autoStart)
  const [replayKey, setReplayKey] = useState(0)
  const autoStartedRef = useRef(false)

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || totalSlides <= 0) return
    autoStartedRef.current = true
    setVisibleCount(0)
    setIsPlaying(true)
  }, [autoStart, totalSlides])

  useEffect(() => {
    if (!isPlaying) return
    if (visibleCount >= totalSlides) {
      setIsPlaying(false)
      return
    }
    const delay = Math.max(180, Math.round(baseDelay / speed))
    const timer = setTimeout(() => {
      setVisibleCount((count) => Math.min(totalSlides, count + 1))
    }, delay)
    return () => clearTimeout(timer)
  }, [isPlaying, visibleCount, totalSlides, speed, baseDelay, replayKey])

  const replay = () => {
    setReplayKey((key) => key + 1)
    setVisibleCount(0)
    setIsPlaying(true)
  }

  const revealAll = () => {
    setVisibleCount(totalSlides)
    setIsPlaying(false)
  }

  return {
    speed,
    setSpeed,
    visibleCount,
    isPlaying,
    replayKey,
    replay,
    revealAll,
    chartDuration: Math.max(700, Math.round(2200 / speed)),
    sectionDuration: Math.max(250, Math.round(520 / speed)),
    speedOptions: SPEED_OPTIONS,
  }
}

export function PresentationControls({ deck, title = 'Presentation mode' }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent-cyan">
        🎬 {title}
      </span>

      <label className="flex items-center gap-2 text-xs text-text-secondary">
        <span>Speed</span>
        <select
          value={String(deck.speed)}
          onChange={(event) => deck.setSpeed(Number(event.target.value))}
          className="rounded-lg border border-border-subtle bg-bg-card px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-cyan/60"
        >
          {deck.speedOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={deck.replay}
        className="rounded-lg border border-accent-magenta/30 bg-accent-magenta/10 px-3 py-1 text-xs font-semibold text-accent-magenta transition-colors hover:bg-accent-magenta/20"
      >
        Replay all
      </button>

      <button
        type="button"
        onClick={deck.revealAll}
        className="rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-1 text-xs font-semibold text-accent-amber transition-colors hover:bg-accent-amber/20"
      >
        Show all
      </button>

      <span className="text-[11px] text-text-muted">
        {deck.isPlaying ? 'Playing one by one…' : 'Ready for recording'}
      </span>
    </div>
  )
}

export function AnimatedPresentationSection({ deck, index, children, className = '' }) {
  const isVisible = deck.visibleCount >= index + 1
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (!isVisible) {
      setEntered(false)
      return
    }
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [isVisible, deck.replayKey])

  const style = useMemo(() => ({
    opacity: entered ? 1 : 0,
    transform: entered ? 'translateY(0px) scale(1)' : 'translateY(22px) scale(0.985)',
    filter: entered ? 'blur(0px)' : 'blur(5px)',
    transition: `opacity ${deck.sectionDuration}ms ease, transform ${deck.sectionDuration}ms ease, filter ${deck.sectionDuration}ms ease`,
  }), [deck.sectionDuration, entered])

  if (!isVisible) return null

  return (
    <div className={className} style={style}>
      {children}
    </div>
  )
}
