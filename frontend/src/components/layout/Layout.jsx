import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => window.innerWidth >= 1024)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e) => setDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return desktop
}

export default function Layout({ children }) {
  const isDesktop = useIsDesktop()
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop)
  const location = useLocation()

  // On mobile, close sidebar when navigating. Desktop stays as-is.
  useEffect(() => {
    if (!isDesktop) setSidebarOpen(false)
  }, [location.pathname, isDesktop])

  // When switching between mobile/desktop, set appropriate default
  useEffect(() => {
    setSidebarOpen(isDesktop)
  }, [isDesktop])

  const handleToggle = useCallback(() => setSidebarOpen(o => !o), [])

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {/* Left slim sidebar: branding + user account */}
      <Sidebar open={sidebarOpen} onToggle={handleToggle} />

      {/* Right area: top nav bar + content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onSidebarToggle={handleToggle} />
        <main className="flex-1 overflow-auto p-6 relative">
          <div className="max-w-[1440px] mx-auto">
            {children || <Outlet />}
          </div>
        </main>
      </div>

      {/* Brand watermark — always visible, appears in screenshots */}
      <div className="fixed bottom-3 right-4 z-50 pointer-events-none flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-primary/70 backdrop-blur-sm border border-border-subtle/30" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
        <img src="/logo.png" alt="" className="w-4 h-4 rounded-sm opacity-70" draggable={false} />
        <span className="text-[10px] font-semibold tracking-wide text-text-muted/60">crickrida.rkjat.in</span>
      </div>
    </div>
  )
}
