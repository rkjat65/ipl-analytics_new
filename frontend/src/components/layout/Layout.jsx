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
    <div className="app-shell flex h-screen overflow-hidden bg-bg-primary text-text-primary">
      {/* Left slim sidebar: branding + user account */}
      <Sidebar open={sidebarOpen} onToggle={handleToggle} />

      {/* Right area: top nav bar + content */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        <Header onSidebarToggle={handleToggle} />
        <main className="relative flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div className="pointer-events-none fixed inset-0 z-0 app-atmosphere" />
          <div className="relative z-10 mx-auto max-w-[1560px]">
            {children || <Outlet />}
          </div>
        </main>
      </div>

      {/* Brand watermark — always visible, appears in screenshots */}
      <div className="fixed bottom-3 right-4 z-50 pointer-events-none flex items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
        <img src="/logo.png" alt="" className="w-4 h-4 rounded-sm opacity-70" draggable={false} />
        <span className="text-[10px] font-semibold tracking-wide text-text-secondary/70">crickrida.rkjat.in</span>
      </div>
    </div>
  )
}
