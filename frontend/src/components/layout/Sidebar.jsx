import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const ADMIN_EMAIL = 'rkdevanda65@gmail.com'

export default function Sidebar({ open, onToggle }) {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

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
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`${
          open ? 'w-52' : 'w-16'
        } bg-bg-elevated border-r border-border-subtle flex flex-col transition-all duration-200 shrink-0 z-50 relative h-full`}
      >
        {/* Brand */}
        <div className="h-14 flex items-center px-4 border-b border-border-subtle gap-3">
          <button
            onClick={onToggle}
            className="text-accent-cyan font-heading font-bold text-lg tracking-tight shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 hover:bg-accent-cyan/20 transition-colors"
          >
            C
          </button>
          {open && (
            <div className="overflow-hidden">
              <span className="font-heading font-bold text-text-primary text-sm tracking-wide">
                Crickrida
              </span>
              <p className="text-[10px] text-text-muted font-mono leading-none">
                Cricket via Stats.
              </p>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User account section */}
        <div className="border-t border-border-subtle p-2 flex flex-col gap-1">
          {isAuthenticated ? (
            <>
              {/* User avatar + name */}
              <div className={`flex items-center gap-2.5 px-2 py-2 rounded-lg ${open ? '' : 'justify-center'}`}>
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name || 'User'}
                    className="w-8 h-8 rounded-full border border-border-subtle object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-accent-cyan/20 border border-accent-cyan/30 flex items-center justify-center shrink-0">
                    <span className="text-accent-cyan text-[11px] font-bold font-mono">
                      {getInitials(user?.name)}
                    </span>
                  </div>
                )}
                {open && (
                  <div className="overflow-hidden">
                    <p className="text-text-primary text-xs font-medium truncate">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-text-muted text-[10px] font-mono truncate">
                      {user?.email}
                    </p>
                  </div>
                )}
              </div>

              {/* Admin button */}
              {user?.email?.toLowerCase() === ADMIN_EMAIL && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold transition-all ${
                      isActive
                        ? 'bg-accent-amber/15 text-accent-amber border border-accent-amber/30'
                        : 'text-text-muted hover:text-accent-amber hover:bg-accent-amber/10 border border-transparent'
                    } ${!open ? 'justify-center px-0' : ''}`
                  }
                  title="Admin Panel"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  {open && <span>Admin</span>}
                </NavLink>
              )}

              {/* Settings */}
              <button
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors ${!open ? 'justify-center px-0' : ''}`}
                title="Settings"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                {open && <span>Settings</span>}
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-text-muted hover:text-accent-magenta hover:bg-accent-magenta/10 transition-colors ${!open ? 'justify-center px-0' : ''}`}
                title="Sign out"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {open && <span>Sign out</span>}
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20
                text-accent-cyan text-xs font-semibold hover:bg-accent-cyan/20 transition-all ${!open ? 'justify-center px-0' : ''}`}
              title="Login"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {open && <span>Login</span>}
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="h-10 flex items-center justify-center border-t border-border-subtle text-text-muted hover:text-text-primary transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-4 h-4 transition-transform duration-200 ${open ? '' : 'rotate-180'}`}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </aside>
    </>
  )
}
