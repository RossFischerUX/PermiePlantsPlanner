import { test, expect, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

async function getFilteredCount(page: Page): Promise<number> {
  const text = await page.locator('p', { hasText: 'Showing' }).first().textContent() ?? ''
  const match = text.match(/of (\d+) plant/)
  return match ? parseInt(match[1]) : 0
}

function getPlantIds(): { invasivePlantId: string | null; cultivarsPlantId: string | null } {
  try {
    return JSON.parse(fs.readFileSync(path.join('tests', '.test-plant-ids.json'), 'utf-8'))
  } catch {
    return { invasivePlantId: null, cultivarsPlantId: null }
  }
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
    await expect(page.locator('p', { hasText: 'Showing' })).toContainText(`of ${initialCount}`, { timeout: 10000 })
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

  test('USDA Zone filter section expands and updates URL', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    const zoneBtn = page.locator('aside button').filter({ hasText: 'USDA Zone' })
    await zoneBtn.scrollIntoViewIfNeeded()
    await zoneBtn.click()
    const nineB = page.locator('aside label').filter({ hasText: /^9b/ })
    await expect(nineB).toBeVisible()
    await nineB.locator('input[type="checkbox"]').check()
    await expect(page).toHaveURL(/zones=9b/, { timeout: 5000 })
  })

  test('filter by Native State reduces plant count', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    const initialCount = await getFilteredCount(page)
    const nativeSelect = page.locator('aside select').first()
    await nativeSelect.scrollIntoViewIfNeeded()
    await nativeSelect.selectOption('CA')
    await expect(page).toHaveURL(/state=CA/, { timeout: 5000 })
    const filteredCount = await getFilteredCount(page)
    expect(filteredCount).toBeGreaterThan(0)
    expect(filteredCount).toBeLessThan(initialCount)
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

test.describe('Plant detail page — public', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('clicking plant card navigates to detail page', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    await page.locator('a[href^="/plants/"]').first().click()
    await expect(page).toHaveURL(/\/plants\/[^/]+$/, { timeout: 10000 })
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 })
  })

  test('back link returns to plant browser', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    await page.locator('a[href^="/plants/"]').first().click()
    await page.waitForURL(/\/plants\/[^/]+$/, { timeout: 10000 })
    await page.getByText('← Plant Database').click()
    await expect(page).toHaveURL('/plants')
  })

  test('detail page shows common name and latin name', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    await page.locator('a[href^="/plants/"]').first().click()
    await page.waitForURL(/\/plants\/[^/]+$/, { timeout: 10000 })
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('p.italic')).toBeVisible()
  })

  test('shows invasive badge for invasive plant', async ({ page }) => {
    const { invasivePlantId } = getPlantIds()
    test.skip(!invasivePlantId, 'No invasive plant found — run import-permaculture to completion first')
    await page.goto(`/plants/${invasivePlantId!}`)
    await expect(page.locator('text=Invasive Species')).toBeVisible({ timeout: 10000 })
  })

  test('shows Notable Cultivars section when present', async ({ page }) => {
    const { cultivarsPlantId } = getPlantIds()
    test.skip(!cultivarsPlantId, 'No plant with cultivars found — run import-permaculture to completion first')
    await page.goto(`/plants/${cultivarsPlantId!}`)
    await expect(page.getByText('Notable Cultivars')).toBeVisible({ timeout: 10000 })
    await expect(
      page.locator('section').filter({ hasText: 'Notable Cultivars' }).locator('p')
    ).not.toBeEmpty()
  })
})
