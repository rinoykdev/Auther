import { Route, Routes } from 'react-router-dom'
import LoginPage from '../features/auth/pages/LoginPage'
import SignUpPage from '../features/auth/pages/SignUpPage'
import ForbiddenPage from '../pages/ForbiddenPage'
import HomePage from '../pages/HomePage'
import NotFoundPage from '../pages/NotFoundPage'

/**
 * Central route table.
 *
 * Architecture B.2 keeps every route in one file so the application's surface
 * is readable in a single place rather than scattered across components.
 *
 * DELIBERATELY ABSENT in Milestone 2:
 *   - ProtectedRoute / PublicOnlyRoute guards  -> Milestone 6
 *   - RoleGuard                                -> Milestone 10
 *   - /auth/callback /check-email /reset-password and the remaining screens
 *                                              -> Milestones 4 and 5
 *
 * /login and /signup are present as VISUAL-ONLY pages (approved ahead of
 * Milestone 4). They render the approved design and link to each other
 * (architecture F, requirement 1); neither authenticates anyone, registers
 * anyone, submits a form or touches Supabase.
 *
 * Route guards are a user-experience affordance only. Real access control is
 * enforced by PostgreSQL GRANTs and RLS policies in the database, which apply
 * no matter what the browser does (architecture E.3).
 */
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRoutes
