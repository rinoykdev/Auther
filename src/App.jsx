import { BrowserRouter } from 'react-router-dom'
import AuthProvider from './features/auth/context/AuthProvider'
import AppRoutes from './routes/AppRoutes'

/**
 * Application shell.
 *
 * AuthProvider sits INSIDE BrowserRouter and OUTSIDE AppRoutes: the guards
 * need both router context and session state, and the provider itself must
 * survive navigation rather than remount on every route change — remounting
 * would re-enter the `loading` state and flash the spinner between pages.
 *
 * Still deliberately thin otherwise. Page layout belongs to the pages, which
 * do not agree on one: the auth screens are a full-bleed split, the dashboard
 * is a narrow centred column.
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
