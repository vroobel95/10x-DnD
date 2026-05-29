-- Migration: create_campaigns
-- Creates the top-level ownership container for a GM's data.
-- Also installs the trigger that auto-creates a default campaign for every new user.

-- Table -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS campaigns (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL DEFAULT 'Default Campaign',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row-Level Security ----------------------------------------------------

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own campaigns"
  ON campaigns
  FOR ALL
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-create default campaign on signup --------------------------------
-- SECURITY DEFINER is required: the trigger fires before the new user's
-- RLS policies are satisfied, so the function must run as its owner.

CREATE OR REPLACE FUNCTION create_default_campaign()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO campaigns (user_id, name)
  VALUES (NEW.id, 'Default Campaign');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_campaign();
