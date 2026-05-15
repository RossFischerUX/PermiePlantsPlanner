-- Add permaculture-specific fields to the plants table.
-- forest_garden_layer: which layer of a food forest the plant occupies
-- permaculture_uses: functional roles (nitrogen fixer, dynamic accumulator, edible, etc.)

ALTER TABLE plants
  ADD COLUMN forest_garden_layer TEXT
    CHECK (forest_garden_layer IN ('canopy', 'sub-canopy', 'shrub', 'herb', 'ground cover', 'rhizosphere', 'climber')),
  ADD COLUMN permaculture_uses TEXT[];
