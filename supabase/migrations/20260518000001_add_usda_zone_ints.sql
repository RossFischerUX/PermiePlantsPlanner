-- Half-zone integers: N_a = N*2, N_b = N*2+1 (e.g. 9a=18, 9b=19)
-- Range 2 (1a) through 27 (13b). Existing usda_zones TEXT kept for display.
ALTER TABLE plants
  ADD COLUMN usda_zone_min SMALLINT,
  ADD COLUMN usda_zone_max SMALLINT;
