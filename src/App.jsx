import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes'

/**
 * Application shell.
 *
 * Deliberately thin: it holds the router and nothing else. Page layout belongs
 * to the pages, because they do not agree on one — the placeholder pages want a
 * narrow centred column, while the login screen is a full-bleed split layout.
 * A shared wrapper here would have to be fought by every full-screen page.
 *
 * NOT here in Milestone 2: AuthProvider. It arrives in Milestone 4 and will
 * wrap AppRoutes so session state is available to guards and pages.
 */
function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
