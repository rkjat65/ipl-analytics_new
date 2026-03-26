import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()
  const [initialLoad, setInitialLoad] = useState(true)

  // Auto-collapse sidebar when navigating to any page (except first load)
  useEffect(() => {
    if (initialLoad) {
      setInitialLoad(false)
      return
    }
    // Collapse on navigation (desktop keeps collapsed, mobile always closes)
    setSidebarOpen(false)
  }, [location.pathname])

  const handleToggle = useCallback(() => setSidebarOpen(o => !o), [])

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {/* Left slim sidebar: branding + user account */}
      <Sidebar open={sidebarOpen} onToggle={handleToggle} />

      {/* Right area: top nav bar + content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onSidebarToggle={handleToggle} />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-[1440px] mx-auto">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  )
}
