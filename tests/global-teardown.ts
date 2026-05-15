import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.test.local' })

const SUPABASE_URL = 'https://kbpoxnrlfrjdegfpcyav.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticG94bnJsZnJqZGVnZnBjeWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzEyMDgsImV4cCI6MjA5MjMwNzIwOH0.PTIFN8CZ2QOpJ8ttT-2ij8DB4KmIMiYEkz2Rvbp8a74'

export default async function globalTeardown() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  await supabase.auth.signInWithPassword({
    email: process.env.TEST_USER_EMAIL!,
    password: process.env.TEST_USER_PASSWORD!,
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('plant_lists').delete().eq('owner_id', user.id).like('title', '[TEST]%')
  }
}
