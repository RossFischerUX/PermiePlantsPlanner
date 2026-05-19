CREATE TABLE plant_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  object_plant_id  UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('HELPS', 'AVOIDS')),
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'traditional', 'anecdotal')),
  mechanism TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT plant_relationships_unique_triple
    UNIQUE (subject_plant_id, object_plant_id, relationship_type),
  CONSTRAINT plant_relationships_no_self_ref
    CHECK (subject_plant_id <> object_plant_id)
);

CREATE INDEX plant_relationships_object_plant_id_idx
  ON plant_relationships (object_plant_id);

ALTER TABLE plant_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Relationships are publicly readable"
  ON plant_relationships FOR SELECT
  USING (true);
