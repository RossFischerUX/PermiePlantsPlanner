-- State-level native range as an array of 2-letter state codes: ARRAY['CA','OR','WA']
ALTER TABLE plants
  ADD COLUMN native_states TEXT[];

-- County-level native range (deferred — populated via Flora API when subscribed)
CREATE TABLE plant_native_counties (
  plant_id    UUID    NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  state_code  CHAR(2) NOT NULL,
  county_name TEXT    NOT NULL,
  PRIMARY KEY (plant_id, state_code, county_name)
);

CREATE INDEX plant_native_counties_state_county ON plant_native_counties (state_code, county_name);

-- Public read access (plants table is already world-readable)
ALTER TABLE plant_native_counties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON plant_native_counties FOR SELECT USING (true);
