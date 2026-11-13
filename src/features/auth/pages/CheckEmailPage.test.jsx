import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CheckEmailPage from './CheckEmailPage'
import { renderWithAuth } from '../../../test/renderWithAuth'

/**
 * Check Your Email — duplicate-account handling.
 *
 * This screen is reached both by a genuine new registration and by someone
 * re-entering an address that already has a confirmed account. Supabase makes
 * those two responses identical on purpose, and these tests exist to keep
 * them identical: the failure they guard against is someone "improving" the
 * copy into a definite claim, or branching on `identities` to be helpful.
 */
// renderWithAuth passes `route` straight into MemoryRouter's initialEntries,
// which accepts a location object — so router state needs no helper change.
const renderPage = (email = 'someone@example.com') =>
  renderWithAuth(<CheckEmailPage />, {
    route: { pathname: '/check-email', state: { email } },
  })

describe('CheckEmailPage', () => {
  it('does not claim an email was definitely sent', () => {
    renderPage()
    // The conditional phrasing is the requirement, not a style choice: for an
    // address that already has a confirmed account, nothing was sent.
    expect(screen.getByText(/still needs confirming/i)).toBeInTheDocument()
    expect(screen.queryByText(/we've sent a confirmation link to/i)).not.toBeInTheDocument()
  })

  it('tells an already-registered user that no new email is coming', () => {
    renderPage()
    expect(screen.getByText(/no new email is sent/i)).toBeInTheDocument()
  })

  it('offers sign in and forgot password unconditionally', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /go to sign in/i })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: /forgot your password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('shows the same wording when no address was carried over', () => {
    renderWithAuth(<CheckEmailPage />, { route: '/check-email' })
    expect(screen.getByText(/still needs confirming/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /forgot your password/i })).toBeInTheDocument()
  })
})
