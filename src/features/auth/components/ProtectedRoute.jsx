import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import FullPageSpinner from './FullPageSpinner'

/**
 * Gate for pages that require a session (architecture F, C.9 rule 1).
 *
 * THIS IS NOT A SECURITY BOUNDARY. It runs in the browser, in code the user
 * controls, and anyone can reach the data behind it by calling the API
 * directly. The real controls are the PostgreSQL GRANTs and RLS policies in
 * migration 0001, which apply no matter what the browser does (E.3).
 *
 * What it IS: the reason a signed-out visitor sees the login screen instead of
 * an empty dashboard.
 *
 * The `isLoading` branch is load-bearing. Redirecting before the session has
 * been read from storage bounces every signed-in user to login on every page
 * refresh — the single most common bug in this part of an app.
 */
function ProtectedRoute({ children }) {
  const { isLoading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageSpinner label="Restoring your session" />

  if (!isAuthenticated) {
    // Remember where they were headed so login can send them back (C.9).
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

export default ProtectedRoute
