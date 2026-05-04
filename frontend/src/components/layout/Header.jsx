import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const ROUTE_TITLES = [
  { match: /^\/dashboard/, title: 'IPL Intelligence', section: 'Command Center' },
  { match: /^\/matches/, title: 'Match Center', section: 'Archive' },
  { match: /^\/batting/, title: 'Batting Lab', section: 'Player Analytics' },
  { match: /^\/bowling/, title: 'Bowling Lab', section: 'Player Analytics' },
  { match: /^\/teams/, title: 'Franchise HQ', section: 'Team Analytics' },
  { match: /^\/venues/, title: 'Venue Atlas', section: 'Ground Analytics' },
  { match: /^\/seasons/, title: 'Season Room', section: 'Tournament History' },
  { match: /^\/h2h/, title: 'Rivalry Engine', section: 'Head to Head' },
  { match: /^\/content-studio/, title: 'Content Studio', section: 'Creator Tools' },
  { match: /^\/pulse/, title: 'This Day', section: 'Cricket Pulse' },
]

const quickLinks = [
  { to: '/dashboard#dashboard-insights', label: 'Insights' },
  { to: '/batting', label: 'Batters' },
  { to: '/bowling', label: 'Bowlers' },
  { to: '/teams', label: 'Teams' },
]

export default function Header({ onSidebarToggle }) {
  const location = useLocation()
  const [apiLive, setApiLive] = useState(null)

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
