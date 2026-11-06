import { expect, test } from '@playwright/test'

/**
 * End-to-end smoke tests.
 *
 * Deliberately shallow for Milestone 2: they confirm the app boots, routes and
 * renders. Real journeys (register, verify, log in, reset) arrive in Milestones
 * 4 and 5 — and the email-dependent ones need an inbox strategy that this
 * milestone does not introduce (plan §5.2).
 */
test('home page renders', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Auther' })).toBeVisible()
})

test('login screen renders its content', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  await expect(page.getByPlaceholder(/login with email/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /^login$/i })).toBeVisible()
})

test('login screen stacks on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/login')

  // The panel must remain usable, not overflow horizontally.
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  expect(overflows).toBe(false)
})

test('unknown route shows 404', async ({ page }) => {
  await page.goto('/definitely-not-a-route')
  await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible()
})
