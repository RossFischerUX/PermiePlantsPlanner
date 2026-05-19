# Backlog

Small fixes and improvements not yet assigned to a phase.

---

## AUTH-FIX-01: Friendly duplicate-email error on signup

**File:** `app/(app)/auth/signup/page.tsx`
**Priority:** Low
**Effort:** ~15 min

**Problem:** When a user tries to sign up with an email that already has an account, Supabase either (a) returns a raw `"User already registered"` error or (b) silently sends a confirmation email and shows the "Check your email" screen — both are confusing.

**Fix:** After calling `supabase.auth.signUp()`, check for the duplicate-email condition and set a friendly error message that redirects the user to login instead.

Two cases to handle:
1. Email confirmations **off** — Supabase returns `error.message` containing `"already registered"`
2. Email confirmations **on** — Supabase returns `data.user` with `data.user.identities?.length === 0` (no new identity created)

```typescript
const { data, error } = await supabase.auth.signUp({ email, password })
setLoading(false)

const isDuplicate =
  error?.message.toLowerCase().includes('already registered') ||
  (data?.user && (data.user.identities?.length ?? 1) === 0)

if (isDuplicate) {
  setError("Looks like you already have an account! Please log in to continue.")
  return
}
if (error) { setError(error.message); return }
setDone(true)
```

The error renders at line 74 (`{error && <p className="text-red-600 text-sm">{error}</p>}`) with a "Sign in" link already below it at line 83–86, so no layout changes needed.
