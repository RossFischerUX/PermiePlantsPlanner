import { test, expect, type Page } from '@playwright/test'

async function getFilteredCount(page: Page): Promise<number> {
  const text = await page.locator('p', { hasText: 'Showing' }).first().textContent() ?? ''
  const match = text.match(/of (\d+) plant/)
  return match ? parseInt(match[1]) : 0
}

test.describe('Plant browser — public', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('loads plants with count badge', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    const count = await getFilteredCount(page)
    expect(count).toBeGreaterThan(0)
  })

  test('search for "lavender" returns only Lavender', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    await page.fill('input[type="search"]', 'lavender')
    await page.waitForSelector('p:has-text("Showing")')
    const count = await getFilteredCount(page)
    expect(count).toBe(1)
    await expect(page.getByText('Lavender')).toBeVisible()
  })

  test('clearing search restores plants', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    const initialCount = await getFilteredCount(page)
    await page.fill('input[type="search"]', 'lavender')
    await expect(page.locator('p', { hasText: 'Showing' })).toContainText('of 1 plant', { timeout: 5000 })
    await page.fill('input[type="search"]', '')
    await expect(page.locator('p', { hasText: 'Showing' })).not.toContainText('of 1 plant', { timeout: 5000 })
    const restoredCount = await getFilteredCount(page)
    expect(restoredCount).toBe(initialCount)
  })

  test('filter by "full sun" reduces plant count', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    const initialCount = await getFilteredCount(page)
    await page.locator('aside button').filter({ hasText: 'Sun' }).click()
    await page.locator('aside label').filter({ hasText: 'full sun' }).locator('input[type="checkbox"]').check()
    await expect(page.locator('p', { hasText: 'Showing' })).not.toContainText(`of ${initialCount}`, { timeout: 5000 })
    const filteredCount = await getFilteredCount(page)
    expect(filteredCount).toBeGreaterThan(0)
    expect(filteredCount).toBeLessThan(initialCount)
  })

  test('filter by water "low" + type "shrub" combines correctly', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    const initialCount = await getFilteredCount(page)
    await page.locator('aside button').filter({ hasText: 'Water' }).click()
    await page.locator('aside label').filter({ hasText: /^low/ }).locator('input[type="checkbox"]').check()
    await page.locator('aside button').filter({ hasText: 'Type' }).click()
    await page.locator('aside label').filter({ hasText: /^shrub/ }).locator('input[type="checkbox"]').check()
    await expect(page.locator('p', { hasText: 'Showing' })).not.toContainText(`of ${initialCount}`, { timeout: 5000 })
    const filteredCount = await getFilteredCount(page)
    expect(filteredCount).toBeGreaterThan(0)
    expect(filteredCount).toBeLessThan(initialCount)
  })

  test('"Clear all" appears after filter applied and resets', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    const initialCount = await getFilteredCount(page)
    await page.locator('aside button').filter({ hasText: 'Sun' }).click()
    await page.locator('aside label').filter({ hasText: 'full sun' }).locator('input[type="checkbox"]').check()
    await expect(page.locator('aside').getByText('Clear all')).toBeVisible()
    await page.locator('aside').getByText('Clear all').click()
    await expect(page.locator('p', { hasText: 'Showing' })).not.toContainText('of 1 plant', { timeout: 5000 })
    const restoredCount = await getFilteredCount(page)
    expect(restoredCount).toBe(initialCount)
    await expect(page.locator('aside').getByText('Clear all')).not.toBeVisible()
  })

  test('no "Add to list" button when logged out', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    expect(await page.getByRole('button', { name: '+ Add to list' }).count()).toBe(0)
  })

  test('shows empty state when no plants match filters', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    await page.locator('aside button').filter({ hasText: 'Type' }).click()
    await page.locator('aside label').filter({ hasText: /^vine/ }).locator('input[type="checkbox"]').check()
    await page.locator('aside button').filter({ hasText: 'Sun' }).click()
    await page.locator('aside label').filter({ hasText: 'full shade' }).locator('input[type="checkbox"]').check()
    await expect(page.getByText('No plants match your filters.')).toBeVisible()
  })
})

test.describe('Plant browser — logged in', () => {
  test.use({ storageState: 'tests/.auth-state.json' })

  test('"Add to list" button visible when user has a list', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    const addBtn = page.getByRole('button', { name: '+ Add to list' }).first()
    await expect(addBtn).toBeVisible({ timeout: 10000 })
  })

  test('clicking "Add to list" opens dropdown with list names', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    await page.getByRole('button', { name: '+ Add to list' }).first().click()
    await expect(page.getByText('[TEST] Presentation List')).toBeVisible()
  })

  test('selecting a list changes button to "✓ Added"', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    await page.fill('input[type="search"]', 'yarrow')
    await page.waitForSelector('p:has-text("Showing")')
    await page.getByRole('button', { name: '+ Add to list' }).first().click()
    await page.getByText('[TEST] Presentation List').click()
    await expect(page.getByRole('button', { name: '✓ Added' })).toBeVisible()
  })
})
