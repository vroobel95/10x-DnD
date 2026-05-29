-- Migration: create_battles
-- Creates the battles table as the container for AI-generated enemies within a campaign.
-- RLS enforced via FK-chain: battles.campaign_id → campaigns.user_id = auth.uid()

-- Table -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS battles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  party_level INTEGER,
  location    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row-Level Security ----------------------------------------------------

ALTER TABLE battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own battles"
  ON battles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = battles.campaign_id
        AND campaigns.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = battles.campaign_id
        AND campaigns.user_id = auth.uid()
    )
  );
