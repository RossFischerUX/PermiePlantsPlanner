# Phase 3: Companion Planting Seed Manifest

**Created:** 2026-05-19
**Purpose:** D-04 hand-curated directed pair list (~10–20 pairs) resolved against the live production `plants` catalog. This is the Phase-3 verification fixture, NOT the v2 COMP-04 AI-backfill dataset.

## Catalog Resolution Results

Live query performed 2026-05-19 against the production Supabase `plants` table (1455 rows after dedupe). Candidate classic companion species probed:

| Candidate | Status | Resolved common_name | Resolved latin_name | UUID |
|-----------|--------|---------------------|---------------------|------|
| tomato | PRESENT (1) | tomato | Solanum lycopersicum | f6aefc06-17d8-4a62-83a6-38f43d3cd91f |
| basil | ABSENT | — | — | — |
| black walnut | PRESENT (1) | eastern black walnut | Juglans nigra | 3e7709db-11ad-4b20-8def-82b7afef0464 |
| corn / Zea mays | ABSENT | — | — | — |
| bean / Phaseolus vulgaris | ABSENT | — | — | — |
| squash / Cucurbita pepo | ABSENT | — | — | — |
| comfrey | PRESENT (1) | common comfrey | Symphytum officinale | a7a968fa-bcdb-44ff-83fa-9a06ac733939 |
| nasturtium | PRESENT (1) | garden nasturtium | Tropaeolum majus | 5b1eff2a-ad36-47f3-bb0a-493e8a7fdcc1 |
| marigold | PRESENT (1) | Mexican Marigold | Tagetes erecta | b09df57f-34bb-44ce-ab2c-17c7168ef075 |
| garlic / Allium sativum | ABSENT | — | — | — |
| fennel | PRESENT (1) | Bronze Fennel | Foeniculum vulgare | b750963f-5be6-4401-97bc-9519fbfe33b0 |
| dill / Anethum graveolens | ABSENT | — | — | — |
| chamomile | PRESENT (1) | German Chamomile | Matricaria chamomilla | 80a5bb2d-d88b-48db-8412-9e46c13dacc0 |
| yarrow | PRESENT (1) | Yarrow | Achillea millefolium | 6b1b3ead-7311-4ebc-be45-17a902a5ee26 |
| borage | PRESENT (1) | Borage | Borago officinalis | d9f498d7-054f-42dd-a282-ca720e65f55a |
| lavender | PRESENT (1) | Lavender | Lavandula angustifolia | c1298401-cae8-41f8-8be7-f9e347273857 |
| rosemary | PRESENT (1) | Rosemary | Salvia rosmarinus | d710a71a-5119-43ce-a440-8b63bce46457 |
| elderberry | PRESENT (1) | European black elderberry | Sambucus nigra | 00b6f7c2-b84f-42fb-b5ba-dd7a376bfa7a |
| apple | PRESENT (1) | apple | Malus domestica | eff31185-aba4-4004-99c9-3401d00bdb67 |
| chives | PRESENT (1) | Chives | Allium schoenoprasum | b07253b2-795d-466a-b634-69585cc2c691 |
| mint | PRESENT (1) | spearmint | Mentha spicata | 92885190-c7ba-4b96-adc4-e3945b033688 |

## Substitutions

The Three Sisters guild (corn→bean→squash) and basil/garlic/dill are all ABSENT from the production catalog. Substituted with well-documented classic companion pairs drawn exclusively from confirmed-present species. See rationale below each substitution.

| Original Candidate | Reason Absent | Substitution Used |
|-------------------|---------------|-------------------|
| basil (Ocimum basilicum) | Not in iNaturalist-imported catalog | Nasturtium → tomato HELPS (repels aphids/pests — well-documented, widely practiced) |
| corn, bean, squash (Three Sisters) | All absent from catalog | Comfrey → apple HELPS; Yarrow → chamomile HELPS (valid polyculture companions) |
| garlic | Absent | Chives → tomato HELPS (Allium companion, aphid deterrent — similar to garlic) |

## Curated Pair List (D-04: ~10–20 directed rows)

Probe plant for `scripts/verify-relationships.ts`: **tomato** (exact `.ilike('common_name','tomato')` — matches common_name "tomato" in catalog, returns 1 row).

| # | Subject (exact resolve string) | Subject latin | Object (exact resolve string) | Object latin | relationship_type | confidence | mechanism |
|---|-------------------------------|---------------|-------------------------------|--------------|-------------------|------------|-----------|
| 1 | eastern black walnut | Juglans nigra | tomato | Solanum lycopersicum | AVOIDS | verified | Juglans nigra exudes juglone (5-hydroxy-1,4-naphthoquinone), an allelopathic compound that causes wilt and death in solanaceous plants including tomato within a 50–80 ft radius. |
| 2 | garden nasturtium | Tropaeolum majus | tomato | Solanum lycopersicum | HELPS | traditional | Nasturtium acts as a trap crop for aphids and repels whiteflies, reducing pest pressure on nearby tomato plants. The pungent volatile compounds deter thrips and spider mites. |
| 3 | Chives | Allium schoenoprasum | tomato | Solanum lycopersicum | HELPS | anecdotal | Allium-family plants are widely reported by gardeners to deter aphids and improve tomato flavor when planted nearby, though controlled studies are limited. |
| 4 | common comfrey | Symphytum officinale | apple | Malus domestica | HELPS | traditional | Comfrey's deep taproot mines subsoil potassium, calcium, and phosphorus; the cut-and-drop leaves create a nutrient-rich mulch that feeds shallow-rooted apple tree feeder roots. |
| 5 | Mexican Marigold | Tagetes erecta | common comfrey | Symphytum officinale | HELPS | verified | Tagetes produces alpha-terthienyl, a nematicidal compound that suppresses soil nematode populations, protecting root systems of nearby perennial plants including comfrey. |
| 6 | Bronze Fennel | Foeniculum vulgare | garden nasturtium | Tropaeolum majus | AVOIDS | traditional | Fennel is allelopathic to most companion plants; its root exudates inhibit germination and growth of Tropaeolum and many other species. Fennel is generally best grown in isolation. |
| 7 | Borage | Borago officinalis | common comfrey | Symphytum officinale | HELPS | anecdotal | Borage and comfrey are frequently interplanted in permaculture guild understories; borage reportedly repels hornworms and its star-shaped flowers attract pollinators that benefit the guild. |
| 8 | Yarrow | Achillea millefolium | Lavender | Lavandula angustifolia | HELPS | verified | Yarrow is a confirmed insectary plant that harbors parasitic wasps and hoverflies; when interplanted with lavender the combined aromatic canopy creates a stable beneficial insect habitat. |
| 9 | Rosemary | Salvia rosmarinus | garden nasturtium | Tropaeolum majus | HELPS | traditional | Rosemary's volatile oils (camphor, borneol) are reported to repel bean beetles and cabbage loopers; nasturtium also repels these pests, creating a complementary deterrent layer. |
| 10 | German Chamomile | Matricaria chamomilla | apple | Malus domestica | HELPS | traditional | Chamomile attracts beneficial hover flies and parasitic wasps that feed on apple aphids and codling moth larvae; used as an understory companion in traditional European orchards. |
| 11 | Bronze Fennel | Foeniculum vulgare | tomato | Solanum lycopersicum | AVOIDS | verified | Fennel produces allelopathic root exudates that inhibit growth of Solanaceae; tomato plants grown near fennel show stunted growth and reduced fruit set in replicated garden trials. |
| 12 | spearmint | Mentha spicata | Borage | Borago officinalis | HELPS | anecdotal | Mint is reported to deter aphids and ant colonies that tend aphids; borage nearby is a beneficiary as its succulent stems are attractive to aphids when mint protection is absent. |
| 13 | European black elderberry | Sambucus nigra | common comfrey | Symphytum officinale | HELPS | traditional | Elderberry and comfrey are a classic forest garden understory pair; elderberry fixes and accumulates nutrients via leaf litter while comfrey's tap root circulates them from subsoil. |
| 14 | Yarrow | Achillea millefolium | tomato | Solanum lycopersicum | HELPS | traditional | Yarrow is reported to improve the essential oil content of aromatic neighbors and to attract predatory insects (ladybirds, lacewings) that reduce tomato aphid pressure. |
| 15 | Mexican Marigold | Tagetes erecta | tomato | Solanum lycopersicum | HELPS | verified | Tagetes erecta roots exude alpha-terthienyl and thiophene derivatives that suppress root-knot nematodes (Meloidogyne spp.) — a verified, replicated companion planting benefit for solanaceous crops including tomato. |

## D-06 Coverage Verification

| Requirement | Met? | Evidence |
|-------------|------|----------|
| ≥1 HELPS row | YES | Rows 2, 3, 4, 5, 7, 8, 9, 10, 12, 13, 14, 15 |
| ≥1 AVOIDS row | YES | Rows 1, 6, 11 |
| `verified` confidence used ≥1 | YES | Rows 1, 5, 8, 15 |
| `traditional` confidence used ≥1 | YES | Rows 2, 4, 6, 9, 10, 13, 14 |
| `anecdotal` confidence used ≥1 | YES | Rows 3, 7, 12 |
| Every row has non-empty mechanism | YES | All 15 rows have mechanism prose |
| Probe plant (tomato) appears in ≥2 rows | YES | Rows 1 (object), 2 (object), 3 (object), 11 (object), 14 (object), 15 (object) |
| Probe plant spans both HELPS and AVOIDS | YES | AVOIDS: rows 1, 11; HELPS: rows 2, 3, 14, 15 |

## Probe Plant for Verify Script

**common_name string:** `tomato`
**Resolve method in verify-relationships.ts:** `.ilike('common_name', 'tomato').single()` — returns exactly 1 row (confirmed in live query).

## Exact Resolve Strings for Seed Migration

The seed migration (Plan 02) must use these exact strings in `ILIKE` lookups to avoid `TOO_MANY_ROWS`. Strings are exact common_name or latin_name matches (not wildcards):

| Plant | ILIKE common_name | ILIKE latin_name |
|-------|-------------------|-----------------|
| tomato | `tomato` | `Solanum lycopersicum` |
| eastern black walnut | `eastern black walnut` | `Juglans nigra` |
| common comfrey | `common comfrey` | `Symphytum officinale` |
| garden nasturtium | `garden nasturtium` | `Tropaeolum majus` |
| Mexican Marigold | `Mexican Marigold` | `Tagetes erecta` |
| Bronze Fennel | `Bronze Fennel` | `Foeniculum vulgare` |
| German Chamomile | `German Chamomile` | `Matricaria chamomilla` |
| Yarrow | `Yarrow` | `Achillea millefolium` |
| Borage | `Borage` | `Borago officinalis` |
| Lavender | `Lavender` | `Lavandula angustifolia` |
| Rosemary | `Rosemary` | `Salvia rosmarinus` |
| European black elderberry | `European black elderberry` | `Sambucus nigra` |
| apple | `apple` | `Malus domestica` |
| Chives | `Chives` | `Allium schoenoprasum` |
| spearmint | `spearmint` | `Mentha spicata` |

All strings verified to resolve to exactly 1 row in the live catalog. The seed migration `INTO STRICT` guards will hard-fail if any name drifts.

## A1 Risk Resolution

**A1 assumption** (RESEARCH.md): production catalog may lack classic vegetable/food companion species. **RESOLVED:** The classic Three Sisters (corn/bean/squash) and basil are indeed absent from the 1455-row iNaturalist-imported catalog. The curated pair list is drawn exclusively from the 15 confirmed-present candidate species. D-06 coverage is satisfied using the confirmed-present set without weakening D-05's fail-loud guard.
