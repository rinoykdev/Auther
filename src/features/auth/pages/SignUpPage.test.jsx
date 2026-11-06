import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import SignUpPage from './SignUpPage'

/**
 * Component tests for the sign-up screen.
 *
 * Two jobs, as with LoginPage. First, confirm the four fields architecture C.1
 * specifies are present and labelled. Second — and the one that matters for
 * this milestone — confirm the screen does NOT register anyone. The scope
 * boundary is what erodes quietly once Milestone 4 work begins, so it is
 * asserted rather than assumed.
 */
const renderPage = () =>
  render(
    <MemoryRouter>
      <SignUpPage />
    </MemoryRouter>,
  )

describe('SignUpPage', () => {
  it('renders exactly the four fields specified in C.1', () => {
    renderPage()

    expect(
      screen.getByRole('heading', { name: /create your account/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()

    // Four, and no more. A registration form that grows extra fields is a
    // deliberate decision, not an accident, so this fails if one appears.
    expect(screen.getAllByRole('textbox')).toHaveLength(2) // name + email
    expect(
      document.querySelectorAll('input[type="password"]'),
    ).toHaveLength(2)
  })

  it('marks both password fields as new-password for password managers', () => {
    renderPage()

    // Tells the browser this is a registration, so it offers to generate and
    // store a password instead of autofilling an existing one into confirm.
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
    expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
  })

  it('accepts typed input', async () => {
    const user = userEvent.setup()
    renderPage()

    const name = screen.getByLabelText(/full name/i)
    await user.type(name, 'Ada Lovelace')

    expect(name).toHaveValue('Ada Lovelace')
  })

  it('does not validate, submit or register when the button is clicked', async () => {
    const user = userEvent.setup()
    renderPage()

    // Mismatched passwords on purpose. This screen is visual only: it must not
    // claim to check them. Matching is enforced in Milestone 4, and the
    // confirm value is never sent anywhere (architecture C.1).
    await user.type(screen.getByLabelText(/^password$/i), 'correct-horse')
    await user.type(screen.getByLabelText(/confirm password/i), 'different')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(screen.queryByText(/do not match/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /create your account/i }),
    ).toBeInTheDocument()
  })

  it('links back to Login without carrying the typed email across', async () => {
    const user = userEvent.setup()
    renderPage()

    const link = screen.getByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/login')

    // Architecture H.3 Family 3: account enumeration.
    await user.type(screen.getByLabelText(/^email$/i), 'someone@example.com')
    expect(link).toHaveAttribute('href', '/login')
  })
})
