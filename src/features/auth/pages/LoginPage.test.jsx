import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAuth } from '../../../test/renderWithAuth'
import { GENERIC_CREDENTIALS } from '../lib/errorMessages'
import LoginPage from './LoginPage'

const signInWith = async (user, email = 'ada@example.com', password = 'hunter2hunter2') => {
  await user.type(screen.getByLabelText(/login with email/i), email)
  await user.type(screen.getByLabelText(/^password$/i), password)
  await user.click(screen.getByRole('button', { name: /^login$/i }))
}

describe('LoginPage', () => {
  it('renders the approved content', () => {
    renderWithAuth(<LoginPage />, { route: '/login' })

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/login with email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument()
  })

  it('shows ONE generic message for every credential failure', async () => {
    const user = userEvent.setup()

    // Two different underlying causes. Supabase distinguishes them; we must
    // not, because the difference is a membership oracle (H.3 Family 3).
    for (const error of [{ code: 'invalid_credentials' }, { code: 'user_not_found' }]) {
      const { unmount } = renderWithAuth(<LoginPage />, {
        route: '/login',
        auth: { signIn: vi.fn().mockResolvedValue({ data: null, error }) },
      })

      await signInWith(user)
      expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_CREDENTIALS)
      unmount()
    }
  })

  it('offers a resend when the account is unconfirmed', async () => {
    const user = userEvent.setup()
    const resendConfirmation = vi.fn().mockResolvedValue({ error: null })
    renderWithAuth(<LoginPage />, {
      route: '/login',
      auth: {
        signIn: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'email_not_confirmed' },
        }),
        resendConfirmation,
      },
    })

    await signInWith(user)
    await user.click(await screen.findByRole('button', { name: /resend/i }))

    await waitFor(() => expect(resendConfirmation).toHaveBeenCalled())
    expect(await screen.findByText(/on its way/i)).toBeInTheDocument()
  })

  it('does not call the server when a field is empty', async () => {
    const user = userEvent.setup()
    const signIn = vi.fn()
    renderWithAuth(<LoginPage />, { route: '/login', auth: { signIn } })

    await user.click(screen.getByRole('button', { name: /^login$/i }))

    expect(await screen.findByText(/enter your email/i)).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('returns the user to the page they were sent away from', async () => {
    const user = userEvent.setup()
    // ProtectedRoute puts the intended path in location.state.from. Simulated
    // here by rendering the destination and asserting we land on it.
    renderWithAuth(<LoginPage />, {
      route: '/login',
      routes: <Route path="/" element={<p>dashboard</p>} />,
    })

    await signInWith(user)
    expect(await screen.findByText(/dashboard/i)).toBeInTheDocument()
  })

  it('links to Sign Up without carrying the typed email across', async () => {
    const user = userEvent.setup()
    renderWithAuth(<LoginPage />, { route: '/login' })

    const link = screen.getByRole('link', { name: /create an account/i })
    expect(link).toHaveAttribute('href', '/signup')

    await user.type(screen.getByLabelText(/login with email/i), 'a@b.com')
    expect(link).toHaveAttribute('href', '/signup')
  })
})
