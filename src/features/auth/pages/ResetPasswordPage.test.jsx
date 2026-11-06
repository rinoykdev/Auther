import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAuth } from '../../../test/renderWithAuth'
import ResetPasswordPage from './ResetPasswordPage'

/**
 * C.9 rule 2 is the reason this file exists.
 *
 * The recovery link creates a REAL session, so "is the user signed in?" is the
 * wrong question — and the wrong gate here would let any signed-in user reach
 * the password form by typing the URL.
 */
describe('ResetPasswordPage', () => {
  it('refuses to render the form without a PASSWORD_RECOVERY event', () => {
    renderWithAuth(<ResetPasswordPage />, {
      route: '/reset-password',
      auth: { passwordRecovery: false },
    })

    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /isn't valid/i })).toBeInTheDocument()
  })

  it('STILL refuses for an ordinary signed-in user', () => {
    // The case the obvious implementation gets wrong: a real session is
    // present, and it is not enough.
    renderWithAuth(<ResetPasswordPage />, {
      route: '/reset-password',
      auth: {
        passwordRecovery: false,
        isAuthenticated: true,
        status: 'authenticated',
        user: { id: 'u1', email: 'ada@example.com' },
      },
    })

    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument()
  })

  it('renders the form when the recovery event fired in this page load', () => {
    renderWithAuth(<ResetPasswordPage />, {
      route: '/reset-password',
      auth: { passwordRecovery: true },
    })

    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
  })

  it('signs the user out after a successful change', async () => {
    const user = userEvent.setup()
    const updatePassword = vi.fn().mockResolvedValue({ data: {}, error: null })
    const signOut = vi.fn().mockResolvedValue({ error: null })

    renderWithAuth(<ResetPasswordPage />, {
      route: '/reset-password',
      auth: { passwordRecovery: true, updatePassword, signOut },
    })

    await user.type(screen.getByLabelText(/^new password$/i), 'brand-new-password')
    await user.type(screen.getByLabelText(/confirm new password/i), 'brand-new-password')
    await user.click(screen.getByRole('button', { name: /save new password/i }))

    // The recovery session proved mailbox control, not knowledge of the new
    // password. Ending it forces the new password to be used at least once.
    expect(updatePassword).toHaveBeenCalledWith({ password: 'brand-new-password' })
    expect(signOut).toHaveBeenCalled()
  })

  it('does not submit mismatched passwords', async () => {
    const user = userEvent.setup()
    const updatePassword = vi.fn()

    renderWithAuth(<ResetPasswordPage />, {
      route: '/reset-password',
      auth: { passwordRecovery: true, updatePassword },
    })

    await user.type(screen.getByLabelText(/^new password$/i), 'brand-new-password')
    await user.type(screen.getByLabelText(/confirm new password/i), 'something-else')
    await user.click(screen.getByRole('button', { name: /save new password/i }))

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument()
    expect(updatePassword).not.toHaveBeenCalled()
  })
})
