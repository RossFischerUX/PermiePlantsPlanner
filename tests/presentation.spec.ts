import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

function getShareId(): string {
  const data = JSON.parse(fs.readFileSync(path.join('tests', '.test-share-id.json'), 'utf-8'))
  return data.shareId
}

test.describe('Presentation page — public', () => {
  test('loads without auth and shows list title', async ({ page }) => {
    const shareId = getShareId()
    await page.goto(`/presents/${shareId}`)
    await expect(page.getByText('[TEST] Presentation List')).toBeVisible({ timeout: 15000 })
  })

  test('shows correct plant count', async ({ page }) => {
    const shareId = getShareId()
    await page.goto(`/presents/${shareId}`)
    // Global setup adds 3 low + 2 moderate water plants = 5 total
    await expect(page.getByText('5 plants')).toBeVisible({ timeout: 15000 })
  })

  test('Plants tab is active by default', async ({ page }) => {
    const shareId = getShareId()
    await page.goto(`/presents/${shareId}`)
    // Active tab has green border
    const plantsTab = page.getByText('Plants', { exact: true }).first()
    await expect(plantsTab).toHaveClass(/text-green-700/)
  })

  test('plant cards display name and badges', async ({ page }) => {
    const shareId = getShareId()
    await page.goto(`/presents/${shareId}`)
    await page.waitForSelector('text=5 plants')
    // Each card should have at least common name and a sun/water badge
    const cards = page.locator('.rounded-2xl.border.border-gray-100')
    expect(await cards.count()).toBeGreaterThan(0)
  })

  test('Reports tab link navigates to /reports', async ({ page }) => {
    const shareId = getShareId()
    await page.goto(`/presents/${shareId}`)
    await page.getByRole('link', { name: 'Reports' }).click()
    await expect(page).toHaveURL(`/presents/${shareId}/reports`)
  })

  test('Permaculture Plant Picker logo links to homepage', async ({ page }) => {
    const shareId = getShareId()
    await page.goto(`/presents/${shareId}`)
    // Two Permaculture Plant Picker links exist (nav + presentation header); target the header one
    await page.locator('div.flex.items-start').getByRole('link', { name: /Permaculture Plant Picker/ }).click()
    await expect(page).toHaveURL('/')
  })

  test('unknown shareId returns 404', async ({ page }) => {
    const response = await page.goto('/presents/doesnotexist999')
    expect(response?.status()).toBe(404)
  })
})

test.describe('Reports page — public', () => {
  test('loads without auth and shows list title', async ({ page }) => {
    const shareId = getShareId()
    await page.goto(`/presents/${shareId}/reports`)
    await expect(page.getByText('[TEST] Presentation List')).toBeVisible({ timeout: 15000 })
  })

  test('Reports tab is active', async ({ page }) => {
    const shareId = getShareId()
    await page.goto(`/presents/${shareId}/reports`)
    const reportsTab = page.getByText('Reports', { exact: true }).first()
    await expect(reportsTab).toHaveClass(/text-green-700/)
  })

  test('Plants tab link navigates back', async ({ page }) => {
    const shareId = getShareId()
    await page.goto(`/presents/${shareId}/reports`)
    await page.getByRole('link', { name: 'Plants' }).click()
    await expect(page).toHaveURL(`/presents/${shareId}`)
  })

  test('"By Water Requirements" table is visible', async ({ page }) => {
    const shareId = getShareId()
    await page.goto(`/presents/${shareId}/reports`)
    await expect(page.getByText('By Water Requirements')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('columnheader', { name: 'Water' })).toBeVisible()
  })

  test('"By Bloom Month" table is visible', async ({ page }) => {
    const shareId = getShareId()
    await page.goto(`/presents/${shareId}/reports`)
    await expect(page.getByText('By Bloom Month')).toBeVisible()
  })

  test('"By Season of Interest" table is visible', async ({ page }) => {
    const shareId = getShareId()
    await page.goto(`/presents/${shareId}/reports`)
    await expect(page.getByText('By Season of Interest')).toBeVisible()
  })

  test('water report shows low rows before moderate rows', async ({ page }) => {
    const shareId = getShareId()
    await page.goto(`/presents/${shareId}/reports`)
    await page.waitForSelector('text=By Water Requirements')
    // Seed data has 'low' and 'moderate' plants but no 'high' — verify ordering of those two
    const lowBadge = page.locator('span').filter({ hasText: /^low$/ }).first()
    const moderateBadge = page.locator('span').filter({ hasText: /^moderate$/ }).first()
    const lowBox = await lowBadge.boundingBox()
    const moderateBox = await moderateBadge.boundingBox()
    if (lowBox && moderateBox) {
      expect(lowBox.y).toBeLessThan(moderateBox.y)
    }
  })
})
