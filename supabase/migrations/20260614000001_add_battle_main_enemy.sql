ALTER TABLE battles
  ADD COLUMN main_enemy_id UUID REFERENCES enemies(id) ON DELETE SET NULL,
  ADD COLUMN main_enemy_profile JSONB;
