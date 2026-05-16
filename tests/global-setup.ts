import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.test.local' })

const BASE_URL = 'https://permacultureplantpicker.com'
const SUPABASE_URL = 'https://kbpoxnrlfrjdegfpcyav.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticG94bnJsZnJqZGVnZnBjeWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzEyMDgsImV4cCI6MjA5MjMwNzIwOH0.PTIFN8CZ2QOpJ8ttT-2ij8DB4KmIMiYEkz2Rvbp8a74'

export default async function globalSetup() {
  const email = process.env.TEST_USER_EMAIL!
  const password = process.env.TEST_USER_PASSWORD!

  // 1. Sign in via UI and save storage state
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(`${BASE_URL}/auth/login`)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE_URL}/lists`, { timeout: 15000 })

  await context.storageState({ path: 'tests/.auth-state.json' })
  await browser.close()

  // 2. Use Supabase client to create a persistent [TEST] list with plants for presentation tests
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  await supabase.auth.signInWithPassword({ email, password })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Could not authenticate test user in global setup')

  // Clean up any leftover test lists from previous runs
  await supabase.from('plant_lists').delete().eq('owner_id', user.id).like('title', '[TEST]%')

  // Create a fresh test list for presentation tests
  const { data: list } = await supabase.from('plant_lists').insert({
    owner_id: user.id,
    title: '[TEST] Presentation List',
    description: 'Auto-generated for Playwright tests',
  }).select().single()

  if (!list) throw new Error('Could not create test list')

  // Fetch 5 plants ordered by common_name — alphabetically this yields
  // Agapanthus (moderate), Blue Oat Grass (low), Butterfly Bush (moderate),
  // California Lilac (low), Coast Rosemary (low) = mixed water levels for report tests
  const { data: plants, error: plantsError } = await supabase
    .from('plants').select('id').order('common_name').limit(5)
  if (plantsError) throw new Error(`Could not fetch plants: ${plantsError.message}`)
  if (plants && plants.length > 0) {
    const { error: itemsError } = await supabase.from('plant_list_items').insert(
      plants.map((p, i) => ({ list_id: list.id, plant_id: p.id, sort_order: i }))
    )
    if (itemsError) throw new Error(`Could not insert plant list items: ${itemsError.message}`)
  }

  // Save share_id for use in tests
  fs.writeFileSync(
    path.join('tests', '.test-share-id.json'),
    JSON.stringify({ shareId: list.share_id, listId: list.id })
  )
}
