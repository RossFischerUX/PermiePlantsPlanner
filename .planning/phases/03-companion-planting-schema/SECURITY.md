---
phase: 03-companion-planting-schema
audited_at: 2026-05-19
asvs_level: 1
auditor: gsd-security-auditor
block_on: high
threats_open: 0
verdict: SECURED
---

# Phase 03 Security Audit — Companion Planting Schema

**Phase:** 03 — Companion Planting Schema (Plans 01 + 02)
**Threats Closed:** 10/10
**ASVS Level:** 1

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-03-01 | Information Disclosure | mitigate | CLOSED | `scripts/verify-relationships.ts:20-23` — `dotenv.config({ path: '.env.local' })` + `process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!`; no literal value committed; `.env*.local` in `.gitignore` |
| T-03-02 | Tampering | mitigate | CLOSED | `lib/types.ts:63-74` — `RelationshipType = 'HELPS' \| 'AVOIDS'` and `RelationshipConfidence = 'verified' \| 'traditional' \| 'anecdotal'` string unions; `mechanism: string \| null` (not optional); no `as any` or `: any` in types.ts or verify-relationships.ts |
| T-03-03 | Repudiation / false-pass | mitigate | CLOSED | `scripts/verify-relationships.ts:49-76` — `const fails: string[]` accumulates assertion failures; `process.exit(1)` at line 75; 03-01-SUMMARY.md records RED-state proof before migration applied |
| T-03-04 | Tampering / Elevation | mitigate | CLOSED | `20260519084146_create_plant_relationships_table.sql:18-23` — `ENABLE ROW LEVEL SECURITY` + `FOR SELECT USING (true)` policy; grep of DDL confirms zero `FOR INSERT`, `FOR UPDATE`, or `FOR DELETE` policy clauses |
| T-03-05 | Tampering | mitigate | CLOSED | `20260519084146_create_plant_relationships_table.sql:5-6` — `CHECK (relationship_type IN ('HELPS', 'AVOIDS'))` and `CHECK (confidence IN ('verified', 'traditional', 'anecdotal'))` present as named constraint column checks |
| T-03-06 | Repudiation / false-pass | mitigate | CLOSED | `20260519084147_seed_plant_relationships.sql:7-20` — `pg_temp.resolve_plant` uses `SELECT id INTO STRICT`; `NO_DATA_FOUND` and `TOO_MANY_ROWS` RAISE handlers present; whole `DO` block rolls back on any RAISE; bare `INSERT...SELECT...ILIKE` pattern absent |
| T-03-07 | Integrity | mitigate | CLOSED | `20260519084147_seed_plant_relationships.sql:7-13` — PL/pgSQL function binds `p_name` and `p_latin` as parameterized args; static literals sourced from 03-SEED-MANIFEST.md; no string-concatenated SQL |
| T-03-08 | Information Disclosure | mitigate | CLOSED | Carries T-03-01 evidence; additionally confirmed no `eyJ...` service_role JWT exists anywhere in committed `.ts`/`.sql`/`.md`/`.json` files; `tests/global-setup.ts` and `tests/global-teardown.ts` contain the public anon key (role: `anon`, JWT payload decoded and confirmed) |
| T-03-09 | Integrity | accept (by design) | CLOSED | `20260519084146_create_plant_relationships_table.sql:3-4` — both FKs declared `ON DELETE CASCADE`; `grep -c` returns 2; accepted behavior documented in 03-02-PLAN.md threat model |
| T-03-SC | Tampering | accept | CLOSED | `package.json` dependencies unchanged from pre-phase baseline; `"verify-relationships": "tsx scripts/verify-relationships.ts"` added to scripts only (no new dependency entry in `dependencies` or `devDependencies`) |

---

## Accepted Risks Log

| Threat ID | Accepted Risk | Rationale |
|-----------|--------------|-----------|
| T-03-09 | Orphan relationship rows after plant delete are self-cleaned by CASCADE | `ON DELETE CASCADE` is the intended cleanup mechanism (D-03); one-directional cascade does not propagate into `plant_list_items`. Documented in 03-02-PLAN.md. |
| T-03-SC | Zero new npm/pip/cargo packages this phase | `scripts/verify-relationships.ts` reuses `@supabase/supabase-js`, `dotenv`, and `tsx` — all pre-existing devDependencies. Confirmed via `package.json` diff. |

---

## Corrective Migration Audit (20260519085708_reseed_plant_relationships_safe.sql)

The corrective reseed migration introduced after the initial seed (WR-03/WR-04/WR-05 fixes) was audited separately:

- **INTO STRICT preserved:** `SELECT id INTO STRICT` present; `NO_DATA_FOUND` and `TOO_MANY_ROWS` RAISE handlers both present — fail-loud posture identical to the original seed migration.
- **No new write policy introduced:** grep for `FOR INSERT/UPDATE/DELETE` returns empty.
- **Bare INSERT...SELECT...ILIKE absent:** the corrective migration uses the same `pg_temp.resolve_plant` parameterized helper.
- **RLS unchanged:** no ALTER POLICY or DROP POLICY statements; existing public SELECT-only policy unaffected.

The corrective migration does not weaken any mitigated threat.

---

## Unregistered Flags

**03-01-SUMMARY.md `## Threat Flags`:** "None. No new network endpoints, auth paths, or schema changes introduced in this plan."

**03-02-SUMMARY.md `## Threat Flags`:** "None — no new security surface beyond the planned RLS-protected table (T-03-04 mitigated: RLS enabled, SELECT-only, no write policy)."

Both SUMMARY files report no unregistered threat flags. No new attack surface was detected during implementation that lacks a threat mapping.

---

## Scope Notes

- Implementation files are READ-ONLY. This audit found no gaps requiring implementation changes.
- The JWT literal in `tests/.auth-state.json` is a Playwright session cookie (role: `authenticated`) for a test user account, not a service-role credential. The JWT in `tests/global-setup.ts` and `tests/global-teardown.ts` is the public anon key (role: `anon`, decoded and confirmed). Neither is a service-role key disclosure.
