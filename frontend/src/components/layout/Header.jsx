import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/matches': 'Matches',
  '/batting': 'Batting',
  '/bowling': 'Bowling',
  '/teams': 'Teams',
  '/h2h': 'Head to Head',
  '/venues': 'Venues',
  '/seasons': 'Seasons',
  '/content-studio': 'Content Studio',
  '/ask': 'Ask Cricket',
  '/login': 'Sign In',
}

export default function Header({ onMenuClick }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()

  const pageTitle = pageTitles[location.pathname] || 'IPL Analytics'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Get user initials for avatar
  const getInitials = (name) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map(w => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <header className="h-14 bg-bg-elevated border-b border-border-subtle flex items-center justify-between px-4 shrink-0">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-text-secondary hover:text-text-primary transition-colors p-1"
          aria-label="Toggle menu"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div>
          <h1 className="text-sm font-heading font-semibold text-text-primary">
            {pageTitle}
          </h1>
          <p className="text-[11px] text-text-muted font-mono">
            IPL Analytics
          </p>
        </div>
      </div>

      {/* Right: branding + user */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-text-muted tracking-wider hidden sm:inline">RKJAT65</span>

        {isAuthenticated ? (
          <div className="flex items-center gap-2.5">
            {/* Separator */}
            <div className="w-px h-5 bg-border-subtle hidden sm:block" />

            {/* User avatar + name */}
            <div className="flex items-center gap-2">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name || 'User'}
                  className="w-7 h-7 rounded-full border border-border-subtle object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-accent-cyan/20 border border-accent-cyan/30 flex items-center justify-center">
                  <span className="text-accent-cyan text-[10px] font-bold font-mono">
                    {getInitials(user?.name)}
                  </span>
                </div>
              )}
              <span className="text-text-primary text-xs font-medium hidden md:inline max-w-[100px] truncate">
                {user?.name || user?.email}
              </span>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="text-text-muted hover:text-accent-magenta transition-colors p-1"
              aria-label="Sign out"
              title="Sign out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <div className="w-px h-5 bg-border-subtle hidden sm:block" />
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20
                text-accent-cyan text-xs font-semibold hover:bg-accent-cyan/20 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Login
            </button>
          </>
        )}
      </div>
    </header>
  )
}
