import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../features/auth/context/AuthContext'

/**
 * Render a component inside a router and a CONTROLLED auth context.
 *
 * The real AuthProvider subscribes to supabase-js, which would make every
 * component test depend on a network client. Supplying the context directly
 * keeps these tests about the component's behaviour, and lets a test state
 * plainly which session it is simulating.
 *
 * Defaults are deliberately "resolved and signed out" rather than `loading`,
 * because a test that forgets to say which it wants should get the ordinary
 * case, not a spinner it has to debug.
 */
export const noop = () => {}

export function renderWithAuth(
  ui,
  {
    auth = {},
    route = '/',
    // Extra routes let a test assert that a component NAVIGATED, by rendering
    // a recognisable marker at the destination.
    routes = null,
  } = {},
) {
  const value = {
    session: null,
    user: null,
    status: 'anonymous',
    isLoading: false,
    isAuthenticated: false,
    passwordRecovery: false,
    clearPasswordRecovery: noop,
    signUp: async () => ({ data: {}, error: null }),
    signIn: async () => ({ data: {}, error: null }),
    signOut: async () => ({ error: null }),
    resendConfirmation: async () => ({ error: null }),
    requestPasswordReset: async () => ({ error: null }),
    updatePassword: async () => ({ data: {}, error: null }),
    ...auth,
  }

  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={value}>
        {routes ? (
          <Routes>
            <Route path={route} element={ui} />
            {routes}
          </Routes>
        ) : (
          ui
        )}
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}
