import { test, expect } from '@playwright/test'

test.describe('Plant browser — public', () => {
  // Force logged-out state even when this file runs under the logged-in project
  test.use({ storageState: { cookies: [], origins: [] } })
  test('loads 20 plants with count badge', async ({ page }) => {
    await page.goto('/plants')
    await expect(page.getByText('20 plants')).toBeVisible({ timeout: 15000 })
  })

  test('search for "lavender" returns only Lavender', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('text=20 plants')
    await page.fill('input[type="search"]', 'lavender')
    await expect(page.getByText('1 plants')).toBeVisible()
    await expect(page.getByText('Lavender')).toBeVisible()
  })

  test('clearing search restores all 20 plants', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('text=20 plants')
    await page.fill('input[type="search"]', 'lavender')
    await expect(page.getByText('1 plants')).toBeVisible()
    await page.fill('input[type="search"]', '')
    await expect(page.getByText('20 plants')).toBeVisible()
  })

  test('filter by "full sun" reduces plant count', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('text=20 plants')
    await page.getByLabel('full sun').check()
    const countText = await page.locator('span.text-sm.text-gray-400').textContent()
    const count = parseInt(countText ?? '0')
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(20)
  })

  test('filter by water "low" + type "shrub" combines correctly', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('text=20 plants')
    await page.getByLabel('low').check()
    await page.getByLabel('shrub').check()
    const countText = await page.locator('span.text-sm.text-gray-400').textContent()
    const count = parseInt(countText ?? '0')
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(20)
  })

  test('"Clear all filters" appears after filter applied and resets', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('text=20 plants')
    await page.getByLabel('full sun').check()
    await expect(page.getByText('Clear all filters')).toBeVisible()
    await page.getByText('Clear all filters').click()
    await expect(page.getByText('20 plants')).toBeVisible()
    await expect(page.getByText('Clear all filters')).not.toBeVisible()
  })

  test('no "Add to list" button when logged out', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('text=20 plants')
    expect(await page.getByRole('button', { name: '+ Add to list' }).count()).toBe(0)
  })

  test('shows empty state when no plants match filters', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('text=20 plants')
    // Filter by an uncommon combination unlikely to exist
    await page.getByLabel('vine').check()
    await page.getByLabel('full shade').check()
    await expect(page.getByText('No plants match your filters.')).toBeVisible()
  })
})

test.describe('Plant browser — logged in', () => {
  test.use({ storageState: 'tests/.auth-state.json' })

  test('"Add to list" button visible when user has a list', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('text=20 plants')
    // After global setup there's at least one [TEST] list
    const addBtn = page.getByRole('button', { name: '+ Add to list' }).first()
    await expect(addBtn).toBeVisible({ timeout: 10000 })
  })

  test('clicking "Add to list" opens dropdown with list names', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('text=20 plants')
    await page.getByRole('button', { name: '+ Add to list' }).first().click()
    await expect(page.getByText('[TEST] Presentation List')).toBeVisible()
  })

  test('selecting a list changes button to "✓ Added"', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('text=20 plants')

    // Search for a specific plant to target a stable card
    await page.fill('input[type="search"]', 'yarrow')
    await page.waitForSelector('text=1 plants')

    await page.getByRole('button', { name: '+ Add to list' }).first().click()
    await page.getByText('[TEST] Presentation List').click()
    await expect(page.getByRole('button', { name: '✓ Added' })).toBeVisible()
  })
})
