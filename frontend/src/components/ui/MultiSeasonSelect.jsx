import { useState, useRef, useEffect, useCallback } from 'react'

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

  // Sorted seasons ascending for range logic
  const sortedAsc = [...seasons].sort((a, b) => a.localeCompare(b))

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setCustomMode(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Position dropdown within the viewport using fixed coordinates so it never gets clipped by parent cards
  const positionDropdown = useCallback(() => {
    if (!ref.current || !dropdownRef.current) return
    const trigger = ref.current.getBoundingClientRect()
    const dd = dropdownRef.current
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    const margin = 8
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
        maxHeight: Math.min(Math.floor(viewportH * 0.6), ddNaturalH),
      })
      return
    }

    const preferredWidth = Math.max(trigger.width, 288)
    let left = Math.min(trigger.left, viewportW - preferredWidth - margin)
    left = Math.max(margin, left)

    const topBelow = trigger.bottom + 6
    const availableBelow = viewportH - topBelow - margin
    const availableAbove = trigger.top - margin

    let top = topBelow
    let maxHeight = Math.max(220, Math.min(ddNaturalH, availableBelow))

    if (availableBelow < 220 && availableAbove > availableBelow) {
      maxHeight = Math.max(220, Math.min(ddNaturalH, availableAbove))
      top = Math.max(margin, trigger.top - maxHeight - 6)
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
      // Run after DOM paint
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

  function selectAll() {
    onChange('')
  }

  function applyCustomRange() {
    if (customFrom && customTo) {
      selectRange(customFrom, customTo)
      setCustomMode(false)
    }
  }

  // Display label
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

  // Quick range buttons (based on descending order — most recent first)
  const sortedDesc = [...seasons].sort((a, b) => b.localeCompare(a))
  const quickRanges = []
  if (sortedDesc.length >= 3) {
    quickRanges.push({ label: 'Last 3', from: sortedDesc[2], to: sortedDesc[0] })
  }
  if (sortedDesc.length >= 5) {
    quickRanges.push({ label: 'Last 5', from: sortedDesc[4], to: sortedDesc[0] })
  }
  if (sortedDesc.length >= 10) {
    quickRanges.push({ label: 'Last 10', from: sortedDesc[9], to: sortedDesc[0] })
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); setCustomMode(false) }}
        className="bg-bg-card border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary font-body focus:outline-none focus:border-accent-cyan transition-colors cursor-pointer pr-8 text-left min-w-[140px]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238888A0' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
        }}
      >
        {displayLabel}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="fixed z-50 bg-bg-elevated border border-border-subtle rounded-lg shadow-xl animate-pop overflow-y-auto"
          style={{
            left: dropdownStyle.left != null ? dropdownStyle.left : 8,
            right: dropdownStyle.right != null ? dropdownStyle.right : 'auto',
            top: dropdownStyle.top != null ? dropdownStyle.top : 'auto',
            bottom: dropdownStyle.bottom != null ? dropdownStyle.bottom : 'auto',
            maxHeight: dropdownStyle.maxHeight != null ? dropdownStyle.maxHeight : '70vh',
            width: dropdownStyle.width != null ? dropdownStyle.width : '18rem',
          }}
        >
          {/* Quick actions row */}
          <div className="flex flex-wrap gap-1.5 p-2.5 border-b border-border-subtle">
            <button
              onClick={selectAll}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                isAll ? 'bg-accent-cyan/20 border-accent-cyan/40 text-accent-cyan' : 'border-border-subtle text-text-secondary hover:text-text-primary'
              }`}
            >
              All
            </button>
            {quickRanges.map(r => (
              <button
                key={r.label}
                onClick={() => selectRange(r.from, r.to)}
                className="px-2.5 py-1 text-xs rounded-md border border-border-subtle text-text-secondary hover:text-text-primary hover:border-accent-cyan/30 transition-colors"
              >
                {r.label}
              </button>
            ))}
            <button
              onClick={() => setCustomMode(!customMode)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                customMode ? 'bg-accent-magenta/20 border-accent-magenta/40 text-accent-magenta' : 'border-border-subtle text-text-secondary hover:text-text-primary hover:border-accent-magenta/30'
              }`}
            >
              Custom
            </button>
          </div>

          {/* Custom range picker */}
          {customMode && (
            <div className="px-2.5 py-2 border-b border-border-subtle bg-bg-card/50">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 font-medium">Custom Range</p>
              <div className="flex items-center gap-2">
                <select
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="flex-1 bg-bg-card border border-border-subtle rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-cyan"
                >
                  <option value="">From</option>
                  {sortedAsc.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="text-text-muted text-xs">to</span>
                <select
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="flex-1 bg-bg-card border border-border-subtle rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-cyan"
                >
                  <option value="">To</option>
                  {sortedAsc.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  onClick={applyCustomRange}
                  disabled={!customFrom || !customTo}
                  className="px-2.5 py-1 text-xs rounded-md bg-accent-cyan/20 border border-accent-cyan/40 text-accent-cyan hover:bg-accent-cyan/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Season grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 p-2.5 max-h-56 overflow-y-auto">
            {sortedDesc.map(s => {
              const isSelected = selected.includes(s)
              return (
                <button
                  key={s}
                  onClick={(e) => {
                    if (e.shiftKey && selected.length > 0) {
                      // Shift-click: select range from last selected to this
                      const lastSelected = selected[selected.length - 1]
                      selectRange(lastSelected, s)
                    } else {
                      toggleSeason(s)
                    }
                  }}
                  className={`px-1 py-1.5 text-xs font-mono rounded transition-colors ${
                    isSelected
                      ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-card border border-transparent'
                  }`}
                >
                  {s}
                </button>
              )
            })}
          </div>

          {/* Selected count + hint */}
          <div className="px-2.5 py-1.5 border-t border-border-subtle flex items-center justify-between">
            <p className="text-[10px] text-text-muted">Click to pick. Shift+click for range.</p>
            {selected.length > 0 && (
              <button
                onClick={selectAll}
                className="text-[10px] text-accent-cyan hover:underline"
              >
                Clear ({selected.length})
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
