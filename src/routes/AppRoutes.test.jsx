import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AppRoutes from './AppRoutes'
import { renderWithAuth } from '../test/renderWithAuth'

/**
 * Route-table tests.
 *
 * These assert the GUARDS behave, which is a user-experience concern only.
 * Real access control is the GRANTs and RLS in migration 0001 and applies
 * however the browser behaves (architecture E.3) — nothing here is a security
 * boundary, and a test passing here proves nothing about the database.
 */
const renderAt = (route, auth) =>
  renderWithAuth(<AppRoutes />, { route, auth })

describe('AppRoutes', () => {
  it('renders the login screen at /login when signed out', () => {
    renderAt('/login')
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('renders the sign-up screen at /signup when signed out', () => {
    renderAt('/signup')
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
  })

  it('sends a signed-out visitor from the dashboard to login', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('keeps a signed-in user off the login screen', () => {
    renderAt('/login', { isAuthenticated: true, status: 'authenticated' })
    expect(screen.queryByRole('heading', { name: /welcome back/i })).not.toBeInTheDocument()
  })

  it('decides nothing while the session is still loading', () => {
    // C.9 rule 1. Redirecting before the session is known bounces every
    // signed-in user to login on each page refresh — so during `loading` the
    // guard must render a spinner and NOT the login screen.
    renderAt('/', { isLoading: true, status: 'loading' })
    expect(screen.queryByRole('heading', { name: /welcome back/i })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('serves the callback and check-email routes without a session', () => {
    renderAt('/check-email')
    expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
  })

  it('falls through to 404 for an unknown route', () => {
    renderAt('/no-such-page')
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument()
  })
})
