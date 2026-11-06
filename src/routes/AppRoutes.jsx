import { Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../features/auth/components/ProtectedRoute'
import PublicOnlyRoute from '../features/auth/components/PublicOnlyRoute'
import AuthCallbackPage from '../features/auth/pages/AuthCallbackPage'
import CheckEmailPage from '../features/auth/pages/CheckEmailPage'
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage'
import LoginPage from '../features/auth/pages/LoginPage'
import ResetPasswordPage from '../features/auth/pages/ResetPasswordPage'
import SignUpPage from '../features/auth/pages/SignUpPage'
import DashboardPage from '../pages/DashboardPage'
import ForbiddenPage from '../pages/ForbiddenPage'
import NotFoundPage from '../pages/NotFoundPage'

/**
 * Central route table.
 *
 * Architecture B.2 keeps every route in one file so the application's surface
 * is readable in a single place rather than scattered across components.
 *
 * Guards here are a USER-EXPERIENCE affordance only. Real access control is
 * enforced by PostgreSQL GRANTs and RLS policies (migration 0001), which apply
 * no matter what the browser does (E.3). Nothing on this page is load-bearing
 * for security.
 *
 * STILL ABSENT, deliberately:
 *   - /profile, /settings/security           -> Milestone 7
 *   - RoleGuard and /admin                   -> Milestone 10
 */
function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnlyRoute>
            <SignUpPage />
          </PublicOnlyRoute>
        }
      />

      {/* Public: the user has no session at either point, by design (C.1.1). */}
      <Route path="/check-email" element={<CheckEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      {/*
        NOT a ProtectedRoute and NOT a PublicOnlyRoute. The recovery link
        creates a real session, so neither guard asks the right question — the
        page gates itself on the PASSWORD_RECOVERY event (C.9 rule 2).
      */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRoutes
