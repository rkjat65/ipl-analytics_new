import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const ROUTE_TITLES = [
  { match: /^\/dashboard/, title: 'IPL Intelligence', section: 'Command Center' },
  { match: /^\/matches/, title: 'Match Center', section: 'Archive' },
  { match: /^\/batting/, title: 'Batting Lab', section: 'Player Analytics' },
  { match: /^\/bowling/, title: 'Bowling Lab', section: 'Player Analytics' },
  { match: /^\/teams/, title: 'Franchise HQ', section: 'Team Analytics' },
  { match: /^\/venues/, title: 'Venue Atlas', section: 'Ground Analytics' },
  { match: /^\/seasons\/2026/, title: 'IPL 2026 Vault', section: 'Championship Vault' },
  { match: /^\/ipl-2026/, title: 'IPL 2026 Vault', section: 'Championship Vault' },
  { match: /^\/seasons/, title: 'Season Room', section: 'Tournament History' },
  { match: /^\/h2h/, title: 'Rivalry Engine', section: 'Head to Head' },
  { match: /^\/content-studio/, title: 'Content Studio', section: 'Creator Tools' },
  { match: /^\/pulse/, title: 'This Day', section: 'Cricket Pulse' },
  { match: /^\/advanced/, title: 'Advanced Labs', section: 'Predictive Models' },
]

const quickLinks = [
  { to: '/dashboard#dashboard-insights', label: 'Insights' },
  { to: '/batting', label: 'Batters' },
  { to: '/bowling', label: 'Bowlers' },
  { to: '/teams', label: 'Teams' },
]

export default function Header({ onSidebarToggle }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [apiLive, setApiLive] = useState(null)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)

  const route = useMemo(
    () => ROUTE_TITLES.find((item) => item.match.test(location.pathname)) || { title: 'Crickrida', section: 'IPL Analytics' },
    [location.pathname]
  )

  useEffect(() => {
    let cancelled = false
    fetch('/api/health')
      .then((res) => {
        if (!cancelled) setApiLive(res.ok)
      })
      .catch(() => {
        if (!cancelled) setApiLive(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const delay = setTimeout(() => {
      fetch(`/api/meta/players?q=${encodeURIComponent(searchQuery)}`)
        .then((res) => {
          if (!res.ok) throw new Error()
          return res.json()
        })
        .then((data) => {
          setSearchResults(data || [])
        })
        .catch(() => setSearchResults([]))
    }, 200)
    return () => clearTimeout(delay)
  }, [searchQuery])

  return (
    <header className="relative z-20 shrink-0 border-b border-white/10 bg-black/35 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-2xl sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onSidebarToggle}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-text-secondary hover:border-accent-cyan/40 hover:text-accent-cyan lg:hidden"
            aria-label="Toggle sidebar"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-text-muted">{route.section}</p>
            <h1 className="truncate text-lg font-black tracking-tight text-text-primary sm:text-xl">{route.title}</h1>
          </div>
        </div>

        {/* Autocomplete Search Bar */}
        <div className="relative flex-1 max-w-[200px] sm:max-w-xs z-30">
          <div className="relative flex items-center">
            <svg
              className="absolute left-3.5 h-3.5 w-3.5 text-text-muted pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSearchOpen(true)
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search player (e.g. Virat)..."
              className="w-full rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-10 pr-8 text-xs font-bold text-text-primary placeholder:text-text-muted focus:border-accent-cyan/50 focus:bg-white/[0.08] focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="absolute right-3 text-text-muted hover:text-white"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {searchOpen && searchResults.length > 0 && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setSearchOpen(false)} 
              />
              <div className="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-white/10 bg-[#090C12]/95 p-2 shadow-2xl backdrop-blur-2xl z-50">
                {searchResults.map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      navigate(`/players/${encodeURIComponent(name)}`)
                      setSearchQuery('')
                      setSearchOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-text-secondary hover:bg-white/[0.07] hover:text-accent-cyan rounded-xl transition-all truncate"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {quickLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-text-secondary hover:border-accent-cyan/35 hover:text-accent-cyan"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
          <span className={`h-2 w-2 rounded-full ${apiLive === false ? 'bg-danger' : apiLive ? 'bg-success' : 'bg-accent-amber'}`} />
          <span className="hidden text-[10px] font-black uppercase tracking-[0.18em] text-text-secondary sm:inline">
            {apiLive === false ? 'API offline' : apiLive ? 'Live data' : 'Checking'}
          </span>
        </div>
      </div>
    </header>
  )
}
