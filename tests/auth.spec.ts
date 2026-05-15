import { test, expect } from '@playwright/test'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.test.local' })

const EMAIL = process.env.TEST_USER_EMAIL!
const PASSWORD = process.env.TEST_USER_PASSWORD!

test.describe('Navigation — logged out', () => {
  test('shows Log in and Sign up in nav', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'My Lists' })).not.toBeVisible()
  })
})

test.describe('Login page', () => {
  test('loads with email + password fields', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
    await expect(page.getByPlaceholder('••••••••')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('shows error on wrong password', async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', 'wrongpassword!')
    await page.click('button[type="submit"]')
    await expect(page.locator('p.text-red-500')).toBeVisible({ timeout: 10000 })
  })

  test('sign in link navigates to signup page', async ({ page }) => {
    await page.goto('/auth/login')
    // Two "Sign up" links exist (nav + form footer); target the one in the paragraph
    await page.locator('p').getByRole('link', { name: 'Sign up' }).click()
    await expect(page).toHaveURL('/auth/signup')
  })

  test('successful login redirects to /lists', async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/lists', { timeout: 15000 })
  })
})

test.describe('Signup page', () => {
  test('loads with email + password fields', async ({ page }) => {
    await page.goto('/auth/signup')
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
    await expect(page.getByPlaceholder('Min. 6 characters')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
  })

  test('log in link navigates to login page', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.getByRole('link', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/auth/login')
  })

  test('submitting form completes (button leaves loading state)', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.fill('input[type="email"]', `test-${Date.now()}@example.com`)
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    // Button shows "Creating account…" during submission — wait for it to leave that state
    await expect(page.getByRole('button', { name: 'Creating account…' })).toBeVisible({ timeout: 5000 })
    // After completion: confirmation screen, redirect, or error — any means the call finished
    await expect(page.getByRole('button', { name: 'Creating account…' })).not.toBeVisible({ timeout: 20000 })
  })
})

test.describe('Auth guards', () => {
  test('/lists redirects to /auth/login when logged out', async ({ page }) => {
    await page.goto('/lists')
    await expect(page).toHaveURL('/auth/login')
  })
})

test.describe('Sign out', () => {
  test('signs out and shows confirmation screen', async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/lists', { timeout: 15000 })

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL('/auth/signout', { timeout: 10000 })
    await expect(page.getByText("You're signed out")).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign back in' })).toBeVisible()
  })
})
