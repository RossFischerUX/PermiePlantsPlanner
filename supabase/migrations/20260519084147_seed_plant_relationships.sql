-- Fail-loud companion planting seed (Phase 3 / D-04 / D-05).
-- Resolves each plant by name via SELECT INTO STRICT; any missing or ambiguous
-- plant name raises an exception and rolls back the entire DO block — no partial
-- inserts are possible. Exact resolve strings are from 03-SEED-MANIFEST.md and
-- were verified against the live production plants catalog (1455 rows, 2026-05-19).

CREATE OR REPLACE FUNCTION pg_temp.resolve_plant(p_name TEXT, p_latin TEXT)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v UUID;
BEGIN
  SELECT id INTO STRICT v FROM plants
    WHERE lower(btrim(common_name)) = lower(btrim(p_name))
      AND lower(btrim(latin_name)) = lower(btrim(p_latin));
  RETURN v;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION 'Seed aborted: plant "%" (%) not found in plants table', p_name, p_latin;
  WHEN TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'Seed aborted: plant "%" (%) matched multiple rows — disambiguate', p_name, p_latin;
END $$;

DO $$
BEGIN
  INSERT INTO plant_relationships
    (subject_plant_id, object_plant_id, relationship_type, confidence, mechanism)
  VALUES
    -- Row 1: eastern black walnut → tomato AVOIDS (verified)
    (pg_temp.resolve_plant('eastern black walnut', 'Juglans nigra'),
     pg_temp.resolve_plant('tomato', 'Solanum lycopersicum'),
     'AVOIDS', 'verified',
     'Juglans nigra exudes juglone (5-hydroxy-1,4-naphthoquinone), an allelopathic compound that causes wilt and death in solanaceous plants including tomato within a 50–80 ft radius.'),

    -- Row 2: garden nasturtium → tomato HELPS (traditional)
    (pg_temp.resolve_plant('garden nasturtium', 'Tropaeolum majus'),
     pg_temp.resolve_plant('tomato', 'Solanum lycopersicum'),
     'HELPS', 'traditional',
     'Nasturtium acts as a trap crop for aphids and repels whiteflies, reducing pest pressure on nearby tomato plants. The pungent volatile compounds deter thrips and spider mites.'),

    -- Row 3: Chives → tomato HELPS (anecdotal)
    (pg_temp.resolve_plant('Chives', 'Allium schoenoprasum'),
     pg_temp.resolve_plant('tomato', 'Solanum lycopersicum'),
     'HELPS', 'anecdotal',
     'Allium-family plants are widely reported by gardeners to deter aphids and improve tomato flavor when planted nearby, though controlled studies are limited.'),

    -- Row 4: common comfrey → apple HELPS (traditional)
    (pg_temp.resolve_plant('common comfrey', 'Symphytum officinale'),
     pg_temp.resolve_plant('apple', 'Malus domestica'),
     'HELPS', 'traditional',
     'Comfrey''s deep taproot mines subsoil potassium, calcium, and phosphorus; the cut-and-drop leaves create a nutrient-rich mulch that feeds shallow-rooted apple tree feeder roots.'),

    -- Row 5: Mexican Marigold → common comfrey HELPS (verified)
    (pg_temp.resolve_plant('Mexican Marigold', 'Tagetes erecta'),
     pg_temp.resolve_plant('common comfrey', 'Symphytum officinale'),
     'HELPS', 'verified',
     'Tagetes produces alpha-terthienyl, a nematicidal compound that suppresses soil nematode populations, protecting root systems of nearby perennial plants including comfrey.'),

    -- Row 6: Bronze Fennel → garden nasturtium AVOIDS (traditional)
    (pg_temp.resolve_plant('Bronze Fennel', 'Foeniculum vulgare'),
     pg_temp.resolve_plant('garden nasturtium', 'Tropaeolum majus'),
     'AVOIDS', 'traditional',
     'Fennel is allelopathic to most companion plants; its root exudates inhibit germination and growth of Tropaeolum and many other species. Fennel is generally best grown in isolation.'),

    -- Row 7: Borage → common comfrey HELPS (anecdotal)
    (pg_temp.resolve_plant('Borage', 'Borago officinalis'),
     pg_temp.resolve_plant('common comfrey', 'Symphytum officinale'),
     'HELPS', 'anecdotal',
     'Borage and comfrey are frequently interplanted in permaculture guild understories; borage reportedly repels hornworms and its star-shaped flowers attract pollinators that benefit the guild.'),

    -- Row 8: Yarrow → Lavender HELPS (verified)
    (pg_temp.resolve_plant('Yarrow', 'Achillea millefolium'),
     pg_temp.resolve_plant('Lavender', 'Lavandula angustifolia'),
     'HELPS', 'verified',
     'Yarrow is a confirmed insectary plant that harbors parasitic wasps and hoverflies; when interplanted with lavender the combined aromatic canopy creates a stable beneficial insect habitat.'),

    -- Row 9: Rosemary → garden nasturtium HELPS (traditional)
    (pg_temp.resolve_plant('Rosemary', 'Salvia rosmarinus'),
     pg_temp.resolve_plant('garden nasturtium', 'Tropaeolum majus'),
     'HELPS', 'traditional',
     'Rosemary''s volatile oils (camphor, borneol) are reported to repel bean beetles and cabbage loopers; nasturtium also repels these pests, creating a complementary deterrent layer.'),

    -- Row 10: German Chamomile → apple HELPS (traditional)
    (pg_temp.resolve_plant('German Chamomile', 'Matricaria chamomilla'),
     pg_temp.resolve_plant('apple', 'Malus domestica'),
     'HELPS', 'traditional',
     'Chamomile attracts beneficial hover flies and parasitic wasps that feed on apple aphids and codling moth larvae; used as an understory companion in traditional European orchards.'),

    -- Row 11: Bronze Fennel → tomato AVOIDS (verified)
    (pg_temp.resolve_plant('Bronze Fennel', 'Foeniculum vulgare'),
     pg_temp.resolve_plant('tomato', 'Solanum lycopersicum'),
     'AVOIDS', 'verified',
     'Fennel produces allelopathic root exudates that inhibit growth of Solanaceae; tomato plants grown near fennel show stunted growth and reduced fruit set in replicated garden trials.'),

    -- Row 12: spearmint → Borage HELPS (anecdotal)
    (pg_temp.resolve_plant('spearmint', 'Mentha spicata'),
     pg_temp.resolve_plant('Borage', 'Borago officinalis'),
     'HELPS', 'anecdotal',
     'Mint is reported to deter aphids and ant colonies that tend aphids; borage nearby is a beneficiary as its succulent stems are attractive to aphids when mint protection is absent.'),

    -- Row 13: European black elderberry → common comfrey HELPS (traditional)
    (pg_temp.resolve_plant('European black elderberry', 'Sambucus nigra'),
     pg_temp.resolve_plant('common comfrey', 'Symphytum officinale'),
     'HELPS', 'traditional',
     'Elderberry and comfrey are a classic forest garden understory pair; elderberry fixes and accumulates nutrients via leaf litter while comfrey''s tap root circulates them from subsoil.'),

    -- Row 14: Yarrow → tomato HELPS (traditional)
    (pg_temp.resolve_plant('Yarrow', 'Achillea millefolium'),
     pg_temp.resolve_plant('tomato', 'Solanum lycopersicum'),
     'HELPS', 'traditional',
     'Yarrow is reported to improve the essential oil content of aromatic neighbors and to attract predatory insects (ladybirds, lacewings) that reduce tomato aphid pressure.'),

    -- Row 15: Mexican Marigold → tomato HELPS (verified)
    (pg_temp.resolve_plant('Mexican Marigold', 'Tagetes erecta'),
     pg_temp.resolve_plant('tomato', 'Solanum lycopersicum'),
     'HELPS', 'verified',
     'Tagetes erecta roots exude alpha-terthienyl and thiophene derivatives that suppress root-knot nematodes (Meloidogyne spp.) — a verified, replicated companion planting benefit for solanaceous crops including tomato.');
END $$;

DROP FUNCTION IF EXISTS pg_temp.resolve_plant(TEXT, TEXT);
