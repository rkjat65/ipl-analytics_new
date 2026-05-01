import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

/**
 * Multi-season selector with individual picks, range selection, custom range, and "All" option.
 * value: comma-separated string (e.g. "2020,2021,2022") or "" for All
 * onChange: receives comma-separated string or ""
 * seasons: array of season strings (e.g. ["2024", "2023", ...])
 */
export default function MultiSeasonSelect({ seasons = [], value = '', onChange }) {
  const [open, setOpen] = useState(false)
  const [customMode, setCustomMode] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState({})
  const ref = useRef(null)
  const dropdownRef = useRef(null)

  const selected = value ? value.split(',').map(s => s.trim()) : []
  const isAll = selected.length === 0

  const sortedAsc = [...seasons].sort((a, b) => a.localeCompare(b))

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        // If dropdown is open, also check if click is inside the portal-rendered dropdown
        if (dropdownRef.current && dropdownRef.current.contains(e.target)) return
        setOpen(false)
        setCustomMode(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const positionDropdown = useCallback(() => {
    if (!ref.current || !dropdownRef.current) return
    const trigger = ref.current.getBoundingClientRect()
    const dd = dropdownRef.current
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    const margin = 12
    const isMobile = viewportW < 640

    dd.style.maxHeight = 'none'
    dd.style.left = ''
    dd.style.right = ''
    dd.style.top = ''
    dd.style.bottom = ''
    dd.style.width = isMobile ? 'auto' : '18rem'

    const ddRect = dd.getBoundingClientRect()
    const ddW = ddRect.width || 288
    const ddNaturalH = ddRect.height || 320

    if (isMobile) {
      setDropdownStyle({
        left: margin,
        right: margin,
        bottom: margin,
        top: 'auto',
        width: 'auto',
        maxHeight: Math.floor(viewportH * 0.7),
      })
      return
    }

    const preferredWidth = Math.max(trigger.width, 300)
    let left = Math.min(trigger.left, viewportW - preferredWidth - margin)
    left = Math.max(margin, left)

    const topBelow = trigger.bottom + 8
    const availableBelow = viewportH - topBelow - margin
    const availableAbove = trigger.top - margin

    let top = topBelow
    let maxHeight = Math.max(240, Math.min(ddNaturalH, availableBelow))

    if (availableBelow < 240 && availableAbove > availableBelow) {
      maxHeight = Math.max(240, Math.min(ddNaturalH, availableAbove))
      top = Math.max(margin, trigger.top - maxHeight - 8)
    }

    setDropdownStyle({
      left,
      top,
      right: 'auto',
      bottom: 'auto',
      width: preferredWidth,
      maxHeight,
    })
  }, [])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(positionDropdown)
      window.addEventListener('resize', positionDropdown)
      window.addEventListener('scroll', positionDropdown, true)
      return () => {
        window.removeEventListener('resize', positionDropdown)
        window.removeEventListener('scroll', positionDropdown, true)
      }
    }
  }, [open, customMode, positionDropdown])

  function toggleSeason(s) {
    if (selected.includes(s)) {
      const next = selected.filter(x => x !== s)
      onChange(next.join(','))
    } else {
      onChange([...selected, s].join(','))
    }
  }

  function selectRange(from, to) {
    const i1 = sortedAsc.indexOf(from)
    const i2 = sortedAsc.indexOf(to)
    if (i1 === -1 || i2 === -1) return
    const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1]
    onChange(sortedAsc.slice(lo, hi + 1).join(','))
  }

  function selectAll() { onChange('') }

  function applyCustomRange() {
    if (customFrom && customTo) {
      selectRange(customFrom, customTo)
      setCustomMode(false)
    }
  }

  let displayLabel = 'All Seasons'
  if (selected.length === 1) {
    displayLabel = selected[0]
  } else if (selected.length > 1) {
    const sorted = [...selected].sort()
    const indices = sorted.map(s => sortedAsc.indexOf(s)).sort((a, b) => a - b)
    const isContiguous = indices.every((v, i, a) => i === 0 || v === a[i - 1] + 1)
    if (isContiguous && sorted.length > 2) {
      displayLabel = `${sorted[0]} – ${sorted[sorted.length - 1]}`
    } else {
      displayLabel = `${selected.length} seasons`
    }
  }

  const sortedDesc = [...seasons].sort((a, b) => b.localeCompare(a))
  const quickRanges = []
  if (sortedDesc.length >= 3) quickRanges.push({ label: 'Last 3', from: sortedDesc[2], to: sortedDesc[0] })
  if (sortedDesc.length >= 5) quickRanges.push({ label: 'Last 5', from: sortedDesc[4], to: sortedDesc[0] })
  if (sortedDesc.length >= 10) quickRanges.push({ label: 'Last 10', from: sortedDesc[9], to: sortedDesc[0] })

  const dropdownContent = open && (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] bg-bg-elevated border border-border-active rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] animate-pop overflow-hidden flex flex-col"
      style={{
        left: dropdownStyle.left ?? 8,
        top: dropdownStyle.top ?? 'auto',
        bottom: dropdownStyle.bottom ?? 'auto',
        maxHeight: dropdownStyle.maxHeight ?? '70vh',
        width: dropdownStyle.width ?? '20rem',
      }}
    >
      <div className="flex flex-wrap gap-1.5 p-3 border-b border-border-subtle bg-bg-card/20">
        <button
          onClick={selectAll}
          className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg border transition-all ${
            isAll ? 'bg-accent-cyan/20 border-accent-cyan/40 text-accent-cyan shadow-glow-cyan' : 'border-border-subtle text-text-muted hover:text-text-primary hover:border-text-muted'
          }`}
        >
          All
        </button>
        {quickRanges.map(r => (
          <button
            key={r.label}
            onClick={() => selectRange(r.from, r.to)}
            className="px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg border border-border-subtle text-text-muted hover:text-text-primary hover:border-accent-cyan/40 transition-all"
          >
            {r.label}
          </button>
        ))}
        <button
          onClick={() => setCustomMode(!customMode)}
          className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg border transition-all ${
            customMode ? 'bg-accent-magenta/20 border-accent-magenta/40 text-accent-magenta shadow-glow-magenta' : 'border-border-subtle text-text-muted hover:text-text-primary hover:border-accent-magenta/40'
          }`}
        >
          Custom
        </button>
      </div>

      {customMode && (
        <div className="p-4 border-b border-border-subtle bg-bg-card/40 space-y-3">
          <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-black">Select Epoch Range</p>
          <div className="flex items-center gap-3">
            <select
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="flex-1 min-w-0"
            >
              <option value="">Start</option>
              {sortedAsc.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="w-4 h-px bg-border-subtle" />
            <select
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="flex-1 min-w-0"
            >
              <option value="">End</option>
              {sortedAsc.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button
            onClick={applyCustomRange}
            disabled={!customFrom || !customTo}
            className="w-full py-2 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-[11px] font-black uppercase tracking-widest hover:bg-accent-cyan/20 transition-all disabled:opacity-20"
          >
            Engage Filter
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto grid grid-cols-4 gap-1 p-3">
        {sortedDesc.map(s => {
          const isSelected = selected.includes(s)
          return (
            <button
              key={s}
              onClick={(e) => {
                if (e.shiftKey && selected.length > 0) {
                  const lastSelected = selected[selected.length - 1]
                  selectRange(lastSelected, s)
                } else {
                  toggleSeason(s)
                }
              }}
              className={`py-2 text-[11px] font-black font-mono rounded-lg transition-all ${
                isSelected
                  ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5 border border-transparent'
              }`}
            >
              {s}
            </button>
          )
        })}
      </div>

      <div className="p-3 border-t border-border-subtle bg-bg-card/20 flex items-center justify-between">
        <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest italic">Pick Multiple &bull; Shift+Range</p>
        {selected.length > 0 && (
          <button
            onClick={selectAll}
            className="text-[9px] font-black uppercase tracking-widest text-accent-magenta hover:underline"
          >
            Reset ({selected.length})
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); setCustomMode(false) }}
        className="w-full bg-bg-card border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-text-primary font-bold focus:outline-none focus:border-accent-cyan transition-all cursor-pointer pr-10 text-left"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238888A0' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 14px center',
        }}
      >
        {displayLabel}
      </button>

      {open && createPortal(dropdownContent, document.body)}
    </div>
  )
}
