import type { SupabaseClient } from "@supabase/supabase-js";

export async function getUserCampaigns(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("campaigns")
    .select("*, battles(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
