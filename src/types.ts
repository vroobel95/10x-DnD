// Shared entity types for DnD 5e entities.
// These types mirror the Supabase database schema defined in supabase/migrations/.
// All UUID and timestamp fields are typed as string (Supabase JS client serialisation).

import type { BattleEnvironment } from "@/lib/schemas/environment";
import type { MainEnemyProfile } from "@/lib/schemas/enemy";

export type { BattleEnvironment };
export type { MainEnemyProfile };

export type EnemyStatus = "pending" | "confirmed";

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Battle {
  id: string;
  campaign_id: string;
  name: string;
  party_level: number | null;
  location: string | null;
  environment: BattleEnvironment | null;
  main_enemy_id: string | null;
  main_enemy_profile: MainEnemyProfile | null;
  created_at: string;
  updated_at: string;
}

export interface Enemy {
  id: string;
  battle_id: string;
  name: string;
  status: EnemyStatus;
  stats: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
