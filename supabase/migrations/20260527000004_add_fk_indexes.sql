CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_battles_campaign_id ON battles(campaign_id);
CREATE INDEX IF NOT EXISTS idx_enemies_battle_id ON enemies(battle_id);
