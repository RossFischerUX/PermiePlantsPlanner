CREATE TABLE plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  common_name TEXT NOT NULL,
  latin_name TEXT,
  description TEXT,
  sun TEXT CHECK (sun IN ('full sun', 'part shade', 'full shade')),
  water TEXT CHECK (water IN ('low', 'moderate', 'high')),
  soil TEXT,
  height_min NUMERIC,
  height_max NUMERIC,
  width_min NUMERIC,
  width_max NUMERIC,
  bloom_months TEXT[],
  season_of_interest TEXT[],
  plant_type TEXT CHECK (plant_type IN ('shrub', 'tree', 'perennial', 'groundcover', 'vine', 'grass')),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plants are publicly readable"
  ON plants FOR SELECT
  USING (true);
