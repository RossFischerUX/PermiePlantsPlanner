---
phase: 3
slug: companion-planting-schema
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-19
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| developer machine → live Supabase (service-role) | Plan 01 Task 2 ad-hoc resolve query + `scripts/verify-relationships.ts` read the production DB with the service-role key | service-role credential, plant catalog reads |
| `.env.local` → committed repo | Service-role key must never leak into committed files (verify script, manifest, package.json) | service-role credential |
| migration SQL → live production Postgres | `supabase db push` applies DDL + seed to the live catalog by reference | schema DDL, seed rows |
| anonymous client → `plant_relationships` RLS | Public SELECT only; no public write path | relationship rows (public, non-sensitive) |
| seed name-resolution → `plants` table | Untrusted name strings resolved via ILIKE; ambiguity/absence must fail loud, not silently | plant name literals → resolved ids |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-01 | Information Disclosure | service-role key in Plan 01 Task 2 resolve query / `scripts/verify-relationships.ts` | mitigate | Key read from `.env.local` via `dotenv` only (`scripts/verify-relationships.ts:20-23`); never hard-coded/echoed/committed; `scripts/` excluded from Next build | closed |
| T-03-02 | Tampering | `lib/types.ts` introducing loose `any` weakening the v2 backfill type contract | mitigate | `RelationshipType`/`RelationshipConfidence` string unions + `mechanism: string \| null` (`lib/types.ts:63-74`); TS strict gates; zero `as any`/`: any` | closed |
| T-03-03 | Repudiation / false-pass | verify harness silently passing over an empty table | mitigate | Honest-gate `fails: string[]` + `process.exit(1)` (`scripts/verify-relationships.ts:49-75`); harness proven RED before trusted GREEN (03-01-SUMMARY.md) | closed |
| T-03-04 | Tampering / Elevation | `plant_relationships` world-writable if RLS omitted | mitigate | `ENABLE ROW LEVEL SECURITY` + SELECT-only `USING (true)`; no INSERT/UPDATE/DELETE policy (`20260519084146_create_plant_relationships_table.sql:18-23`) | closed |
| T-03-05 | Tampering | out-of-vocabulary `relationship_type`/`confidence` poisoning the v2 AI backfill | mitigate | Named CHECK-enum constraints `('HELPS','AVOIDS')` / `('verified','traditional','anecdotal')` (`20260519084146_create_plant_relationships_table.sql:5-6`) | closed |
| T-03-06 | Repudiation / false-pass | silent empty seed (bare `INSERT...SELECT...WHERE ILIKE`) | mitigate | `SELECT id INTO STRICT` + `NO_DATA_FOUND`/`TOO_MANY_ROWS` RAISE; whole `DO` block rolls back (`20260519084147_seed_plant_relationships.sql:7-20`); bare INSERT...SELECT...ILIKE absent | closed |
| T-03-07 | Integrity | SQL injection in seed name resolution | mitigate | Parameterized PL/pgSQL args `p_name`/`p_latin` bound into query, static literals from SEED-MANIFEST (`20260519084147_seed_plant_relationships.sql:7-13`) | closed |
| T-03-08 | Information Disclosure | service-role key in the verify run | mitigate | Carries T-03-01; no service-role JWT in any committed file (repo-wide grep clean; `tests/` JWTs are `anon`/`authenticated`, not service-role) | closed |
| T-03-09 | Integrity | orphan relationship rows after a plant delete | accept (by design) | `ON DELETE CASCADE` on both FKs self-cleans (`20260519084146_create_plant_relationships_table.sql:3-4`, `grep -c` returns 2); intended behavior | closed |
| T-03-SC | Tampering | npm/pip/cargo installs (supply chain) | accept | Zero new dependencies this phase; only a `verify-relationships` script entry added to `package.json`; all tooling pre-existing — RESEARCH.md Package Legitimacy Audit N/A | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-09 | `ON DELETE CASCADE` deliberately removes relationship rows when a referenced plant is deleted. One-directional, no cascade path into `plant_list_items`. Documented intended behavior (RESEARCH.md Runtime State Inventory). | RossFischerUX | 2026-05-19 |
| AR-03-02 | T-03-SC | No package installs occurred this phase (zero new `dependencies`/`devDependencies`). Supply-chain attack surface unchanged; no slopcheck required. | RossFischerUX | 2026-05-19 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-19 | 10 | 10 | 0 | gsd-security-auditor (sonnet) |

### Security Audit 2026-05-19
| Metric | Count |
|--------|-------|
| Threats found | 10 |
| Closed | 10 |
| Open | 0 |

`register_authored_at_plan_time: true` — both PLAN files contained parseable `<threat_model>` blocks. Auditor verified each mitigation exists in the implemented migrations, `lib/types.ts`, and `scripts/verify-relationships.ts`; confirmed the corrective `20260519085708_reseed_plant_relationships_safe.sql` preserves `INTO STRICT` + RLS posture without weakening any mitigation. Return: `## SECURED`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-19
