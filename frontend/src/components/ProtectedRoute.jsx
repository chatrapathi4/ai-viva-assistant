
import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ role }) {
  const { user, profile, loading, error } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        Loading VivaAI...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-semibold">Unable to load your profile</h2>
          <p className="mt-2 text-sm text-muted">
            {error || 'Please sign out and try again.'}
          </p>
        </div>
      </div>
    )
  }

  if (profile.role !== role) {
    return (
      <Navigate
        to={profile.role === 'faculty' ? '/faculty' : '/student'}
        replace
      />
    )
  }

  return <Outlet />
}
