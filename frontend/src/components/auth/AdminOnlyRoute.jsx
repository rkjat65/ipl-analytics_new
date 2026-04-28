import { useAuth } from '../../contexts/AuthContext'
import { PLATFORM_ADMIN_EMAIL } from '../../constants/adminAccess'

export default function AdminOnlyRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || user.email?.toLowerCase() !== PLATFORM_ADMIN_EMAIL) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
          <h2 className="text-lg font-heading font-bold text-text-primary mb-2">Admin only</h2>
          <p className="text-text-muted text-sm">This page is restricted to the platform administrator.</p>
        </div>
      </div>
    )
  }

  return children
}
