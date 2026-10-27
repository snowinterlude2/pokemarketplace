import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

// UI guard only: it keeps signed-out visitors off private screens. The real
// protection is Supabase RLS, which rejects the requests even if this is bypassed.
export function RequireAuth({ admin = false, children }) {
  const { user, loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="font-comic grid min-h-[50vh] place-items-center text-2xl tracking-widest opacity-60">Loading…</div>
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (admin && !isAdmin) return <Navigate to="/" replace />
  return children
}
