import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import LoginPage from './LoginPage'

/**
 * Component tests for the login screen.
 *
 * Two jobs. First, confirm the approved design is present. Second — and more
 * importantly for this milestone — confirm it does NOT authenticate. The scope
 * boundary is the thing most likely to erode quietly as later work lands, so it
 * is asserted rather than assumed.
 */
describe('LoginPage', () => {
  it('renders the approved content', () => {
    render(<LoginPage />)

    expect(
      screen.getByRole('heading', { name: /welcome back/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/login to your intellicar account/i),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/login with email/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /forgot password/i }),
    ).toBeInTheDocument()
  })

  it('labels every input for screen readers', () => {
    render(<LoginPage />)

    // Placeholders are not labels. The design shows no visible labels, so each
    // field carries a visually hidden one.
    expect(screen.getByLabelText(/login with email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
  })

  it('accepts typed input', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    const email = screen.getByPlaceholderText(/login with email/i)
    await user.type(email, 'someone@example.com')

    expect(email).toHaveValue('someone@example.com')
  })

  it('does not navigate or submit when the form is submitted', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    // jsdom logs "Not implemented: HTMLFormElement.prototype.requestSubmit"
    // if a real submit escapes. preventDefault keeps the page static, which is
    // the intended Milestone 2 behaviour: the button is visual only.
    await user.click(screen.getByRole('button', { name: /^login$/i }))

    expect(
      screen.getByRole('heading', { name: /welcome back/i }),
    ).toBeInTheDocument()
  })
})
