-- Add functional data fields to the plants table.
-- succession_role: ecological succession stages (pioneer, early successional, etc.)
-- propagation_methods: methods to propagate the plant (seed, cutting, division, etc.)
-- edible_parts: which parts of the plant are edible (empty array = not edible)
-- harvest_months: months when edible parts are typically harvested
-- establishment_difficulty: how difficult the plant is to establish (easy/moderate/challenging)
-- maintenance_level: ongoing maintenance requirement (low/moderate/high)
-- years_to_bearing: typical earliest years to bearing for food plants; null for non-food plants

ALTER TABLE plants
  ADD COLUMN succession_role TEXT[],
  ADD COLUMN propagation_methods TEXT[],
  ADD COLUMN edible_parts TEXT[],
  ADD COLUMN harvest_months TEXT[],
  ADD COLUMN establishment_difficulty TEXT
    CHECK (establishment_difficulty IN ('easy', 'moderate', 'challenging')),
  ADD COLUMN maintenance_level TEXT
    CHECK (maintenance_level IN ('low', 'moderate', 'high')),
  ADD COLUMN years_to_bearing INTEGER;
