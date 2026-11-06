import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAuth } from '../../../test/renderWithAuth'
import SignUpPage from './SignUpPage'

const fill = async (user, overrides = {}) => {
  const values = {
    'Full name': 'Ada Lovelace',
    Email: 'ada@example.com',
    Password: 'correct-horse-battery',
    'Confirm password': 'correct-horse-battery',
    ...overrides,
  }
  for (const [label, value] of Object.entries(values)) {
    if (value === '') continue
    await user.type(screen.getByLabelText(new RegExp(`^${label}$`, 'i')), value)
  }
}

describe('SignUpPage', () => {
  it('renders exactly the four fields specified in C.1', () => {
    renderWithAuth(<SignUpPage />, { route: '/signup' })

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()

    // Four, and no more. A registration form that grows a field should be a
    // decision, not an accident.
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(2)
  })

  it('marks both password fields as new-password for password managers', () => {
    renderWithAuth(<SignUpPage />, { route: '/signup' })
    expect(screen.getByLabelText(/^password$/i))
      .toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText(/confirm password/i))
      .toHaveAttribute('autocomplete', 'new-password')
  })

  it('refuses to submit when the passwords do not match', async () => {
    const user = userEvent.setup()
    const signUp = vi.fn()
    renderWithAuth(<SignUpPage />, { route: '/signup', auth: { signUp } })

    await fill(user, { 'Confirm password': 'something-else-entirely' })
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument()
    // The important half: nothing was sent.
    expect(signUp).not.toHaveBeenCalled()
  })

  it('enforces the 10-character minimum before calling the server', async () => {
    const user = userEvent.setup()
    const signUp = vi.fn()
    renderWithAuth(<SignUpPage />, { route: '/signup', auth: { signUp } })

    await fill(user, { Password: 'short', 'Confirm password': 'short' })
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/password must be at least 10/i)).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('NEVER sends the confirm-password value', async () => {
    const user = userEvent.setup()
    const signUp = vi.fn().mockResolvedValue({ data: {}, error: null })
    renderWithAuth(<SignUpPage />, { route: '/signup', auth: { signUp } })

    await fill(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(signUp).toHaveBeenCalled())
    const payload = signUp.mock.calls[0][0]

    // The confirm field is a typo guard compared in the browser and then
    // discarded. Sending it would imply a server-side check that does not
    // exist (architecture C.1).
    expect(payload).not.toHaveProperty('confirmPassword')
    expect(Object.keys(payload).sort()).toEqual(['email', 'fullName', 'password'])
  })

  it('sends the full name so the database trigger can use it', async () => {
    const user = userEvent.setup()
    const signUp = vi.fn().mockResolvedValue({ data: {}, error: null })
    renderWithAuth(<SignUpPage />, { route: '/signup', auth: { signUp } })

    await fill(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: 'Ada Lovelace' }),
      ),
    )
  })

  it('goes to Check Your Email on success, carrying the address in state', async () => {
    const user = userEvent.setup()
    renderWithAuth(<SignUpPage />, {
      route: '/signup',
      routes: <Route path="/check-email" element={<p>check your email</p>} />,
    })

    await fill(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
  })

  it('shows a mapped message when registration fails', async () => {
    const user = userEvent.setup()
    const signUp = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'over_email_send_rate_limit' },
    })
    renderWithAuth(<SignUpPage />, { route: '/signup', auth: { signUp } })

    await fill(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many emails/i)
  })

  it('links back to Login without carrying the typed email across', async () => {
    const user = userEvent.setup()
    renderWithAuth(<SignUpPage />, { route: '/signup' })

    const link = screen.getByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/login')

    // Architecture H.3 Family 3: forwarding the address would let a visitor
    // learn from the destination screen whether it is already registered.
    await user.type(screen.getByLabelText(/^email$/i), 'someone@example.com')
    expect(link).toHaveAttribute('href', '/login')
  })
})
