import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { getUserCampaign } from "@/lib/campaigns";
import { generateEnemies } from "@/lib/ai";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Service unavailable" }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const battleId = context.params.id;

  let prompt: string;
  try {
    const body = await context.request.json();
    prompt = (body?.prompt as string | undefined)?.trim() ?? "";
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (prompt.length > 2000) {
    return Response.json({ error: "Prompt is too long (max 2000 characters)" }, { status: 400 });
  }

  const campaign = await getUserCampaign(supabase, user.id);
  if (!campaign) {
    return Response.json({ error: "No campaign found" }, { status: 403 });
  }

  const { data: battle } = await supabase
    .from("battles")
    .select("id, party_level, location")
    .eq("id", battleId)
    .eq("campaign_id", campaign.id)
    .single();

  if (!battle) {
    return Response.json({ error: "Battle not found" }, { status: 404 });
  }

  let enemyGroup;
  try {
    enemyGroup = await generateEnemies(battle, prompt);
  } catch {
    return Response.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }

  const rows = enemyGroup.enemies.map((e) => ({
    battle_id: battle.id,
    name: e.name,
    status: "pending" as const,
    stats: e,
  }));

  const { data: enemies, error: insertError } = await supabase
    .from("enemies")
    .insert(rows)
    .select();

  if (insertError) {
    return Response.json({ error: "Could not save enemies. Please try again." }, { status: 500 });
  }

  return Response.json({ enemies });
};
