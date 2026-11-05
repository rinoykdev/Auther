import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes'

/**
 * Application shell.
 *
 * Holds the router and the page layout wrapper. Deliberately thin: everything
 * route-specific lives in AppRoutes, and everything auth-specific will live in
 * features/auth.
 *
 * NOT here in Milestone 2: AuthProvider. It arrives in Milestone 4 and will
 * wrap AppRoutes so that session state is available to guards and pages.
 */
function App() {
  return (
    <BrowserRouter>
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
        <AppRoutes />
      </div>
    </BrowserRouter>
  )
}

export default App
