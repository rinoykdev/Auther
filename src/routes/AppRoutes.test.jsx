import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AppRoutes from './AppRoutes'

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )

describe('AppRoutes', () => {
  it('renders the login screen at /login', () => {
    renderAt('/login')
    expect(
      screen.getByRole('heading', { name: /welcome back/i }),
    ).toBeInTheDocument()
  })

  it('renders the forbidden page at /forbidden', () => {
    renderAt('/forbidden')
    expect(
      screen.getByRole('heading', { name: /not permitted/i }),
    ).toBeInTheDocument()
  })

  it('falls through to 404 for an unknown route', () => {
    renderAt('/no-such-page')
    expect(
      screen.getByRole('heading', { name: /page not found/i }),
    ).toBeInTheDocument()
  })

  it('has no protected routes yet', () => {
    // Guards arrive in Milestone 6. Until then every route is public, and this
    // test is here so that adding a guard forces a deliberate update rather
    // than slipping in unnoticed.
    renderAt('/')
    expect(screen.queryByText(/redirecting/i)).not.toBeInTheDocument()
  })
})
