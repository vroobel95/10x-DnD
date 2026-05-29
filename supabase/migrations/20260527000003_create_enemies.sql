-- Migration: create_enemies
-- Creates the enemy_status enum and enemies table for AI-generated D&D 5e stat blocks.
-- RLS enforced via two-hop FK-chain: enemies.battle_id → battles.campaign_id → campaigns.user_id

-- Enum ------------------------------------------------------------------

CREATE TYPE enemy_status AS ENUM ('pending', 'confirmed');

-- Table -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS enemies (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id  UUID         NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  name       TEXT         NOT NULL,
  status     enemy_status NOT NULL DEFAULT 'pending',
  stats      JSONB,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Row-Level Security ----------------------------------------------------

ALTER TABLE enemies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own enemies"
  ON enemies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM battles
      JOIN campaigns ON campaigns.id = battles.campaign_id
      WHERE battles.id = enemies.battle_id
        AND campaigns.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM battles
      JOIN campaigns ON campaigns.id = battles.campaign_id
      WHERE battles.id = enemies.battle_id
        AND campaigns.user_id = auth.uid()
    )
  );
