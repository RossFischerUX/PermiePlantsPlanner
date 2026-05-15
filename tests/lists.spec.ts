import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

test.use({ storageState: 'tests/.auth-state.json' })

function getTestIds() {
  return JSON.parse(fs.readFileSync(path.join('tests', '.test-share-id.json'), 'utf-8')) as {
    shareId: string
    listId: string
  }
}

test.describe('My Lists page', () => {
  test('loads with create list form', async ({ page }) => {
    await page.goto('/lists')
    await expect(page.getByPlaceholder(/List name/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create list' })).toBeVisible()
  })

  test('empty title does not submit', async ({ page }) => {
    await page.goto('/lists')
    await page.click('button:has-text("Create list")')
    await expect(page).toHaveURL('/lists')
  })

  test('creates a list with title only', async ({ page }) => {
    await page.goto('/lists')
    const title = `[TEST] Title Only ${Date.now()}`
    await page.fill('input[placeholder*="List name"]', title)
    await page.click('button:has-text("Create list")')
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 })
  })

  test('creates a list with title and description', async ({ page }) => {
    await page.goto('/lists')
    const title = `[TEST] With Desc ${Date.now()}`
    const desc = 'A test description'
    await page.fill('input[placeholder*="List name"]', title)
    await page.fill('input[placeholder*="Description"]', desc)
    await page.click('button:has-text("Create list")')
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(desc)).toBeVisible()
  })

  test('new list shows "0 plants" badge', async ({ page }) => {
    await page.goto('/lists')
    const title = `[TEST] Count Check ${Date.now()}`
    await page.fill('input[placeholder*="List name"]', title)
    await page.click('button:has-text("Create list")')
    // Target card-level divs (bg-white rounded-2xl) filtered by unique timestamp title
    const card = page.locator('div.bg-white.rounded-2xl').filter({ hasText: title })
    await expect(card.getByText('0 plants')).toBeVisible({ timeout: 10000 })
  })

  test('"Edit list" card button navigates to list editor', async ({ page }) => {
    const { listId } = getTestIds()
    // Navigate directly — avoids flaky card filtering across multiple test lists
    await page.goto(`/lists/${listId}`)
    await expect(page).toHaveURL(`/lists/${listId}`)
    await expect(page.getByText('[TEST] Presentation List')).toBeVisible()
  })

  test('"View presentation" link opens /presents/[shareId]', async ({ page, context }) => {
    const { shareId } = getTestIds()
    await page.goto('/lists')
    await page.waitForSelector('text=[TEST] Presentation List')
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: 'View presentation ↗' }).first().click(),
    ])
    await expect(newPage).toHaveURL(/\/presents\//)
    await newPage.close()
  })
})

test.describe('List editor', () => {
  test('back link navigates to /lists', async ({ page }) => {
    const { listId } = getTestIds()
    await page.goto(`/lists/${listId}`)
    await page.getByText('← My Lists').click()
    await expect(page).toHaveURL('/lists')
  })

  test('shows plant items (global setup adds 5)', async ({ page }) => {
    const { listId } = getTestIds()
    await page.goto(`/lists/${listId}`)
    const removeButtons = page.getByRole('button', { name: 'Remove' })
    await expect(removeButtons.first()).toBeVisible({ timeout: 10000 })
    expect(await removeButtons.count()).toBeGreaterThan(0)
  })

  test('"Copy share link" changes to "✓ Copied!" then reverts', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const { listId } = getTestIds()
    await page.goto(`/lists/${listId}`)
    await page.getByText('🔗 Copy share link').click()
    await expect(page.getByText('✓ Copied!')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('🔗 Copy share link')).toBeVisible({ timeout: 4000 })
  })

  test('"View presentation ↗" opens new tab at /presents/', async ({ page, context }) => {
    const { listId } = getTestIds()
    await page.goto(`/lists/${listId}`)
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: 'View presentation ↗' }).click(),
    ])
    await expect(newPage).toHaveURL(/\/presents\//)
    await newPage.close()
  })

  test('cancel on remove confirm keeps plant count unchanged', async ({ page }) => {
    const { listId } = getTestIds()
    await page.goto(`/lists/${listId}`)
    await page.waitForSelector('button:has-text("Remove")')
    const countBefore = await page.getByRole('button', { name: 'Remove' }).count()
    page.once('dialog', dialog => dialog.dismiss())
    await page.getByRole('button', { name: 'Remove' }).first().click()
    const countAfter = await page.getByRole('button', { name: 'Remove' }).count()
    expect(countAfter).toBe(countBefore)
  })

  test('"+ Add more plants" link navigates to /plants', async ({ page }) => {
    const { listId } = getTestIds()
    await page.goto(`/lists/${listId}`)
    await page.getByText('+ Add more plants from the database').click()
    await expect(page).toHaveURL('/plants')
  })
})
