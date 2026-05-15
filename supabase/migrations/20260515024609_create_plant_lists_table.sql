CREATE TABLE plant_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  share_id TEXT UNIQUE DEFAULT substring(md5(random()::text), 1, 13),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE plant_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES plant_lists(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES plants(id),
  sort_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for plant_lists
ALTER TABLE plant_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lists are readable by share_id (public)"
  ON plant_lists FOR SELECT
  USING (true);

CREATE POLICY "Owners can insert their own lists"
  ON plant_lists FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their own lists"
  ON plant_lists FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their own lists"
  ON plant_lists FOR DELETE
  USING (auth.uid() = owner_id);

-- RLS for plant_list_items
ALTER TABLE plant_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "List items are publicly readable"
  ON plant_list_items FOR SELECT
  USING (true);

CREATE POLICY "Owners can insert items into their lists"
  ON plant_list_items FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT owner_id FROM plant_lists WHERE id = list_id)
  );

CREATE POLICY "Owners can update items in their lists"
  ON plant_list_items FOR UPDATE
  USING (
    auth.uid() = (SELECT owner_id FROM plant_lists WHERE id = list_id)
  );

CREATE POLICY "Owners can delete items from their lists"
  ON plant_list_items FOR DELETE
  USING (
    auth.uid() = (SELECT owner_id FROM plant_lists WHERE id = list_id)
  );
