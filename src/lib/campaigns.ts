import type { SupabaseClient } from "@supabase/supabase-js";

export async function getUserCampaign(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("campaigns").select("id").eq("user_id", userId).limit(1).single();
  return data;
}
