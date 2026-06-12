import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { generateEnvironment } from "@/lib/ai";

export const prerender = false;

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

  const battleResult = await supabase
    .from("battles")
    .select("id, party_level, location, campaign_id")
    .eq("id", battleId)
    .single();

  if (battleResult.error) {
    if (battleResult.error.code === "PGRST116") {
      return Response.json({ error: "Battle not found" }, { status: 404 });
    }
    return Response.json({ error: "Could not load battle. Please try again." }, { status: 500 });
  }

  const battle = battleResult.data;

  const campaignResult = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", battle.campaign_id)
    .eq("user_id", user.id)
    .single();

  if (campaignResult.error) {
    if (campaignResult.error.code === "PGRST116") {
      return Response.json({ error: "Battle not found" }, { status: 404 });
    }
    return Response.json({ error: "Could not load battle. Please try again." }, { status: 500 });
  }

  let environment: Awaited<ReturnType<typeof generateEnvironment>>;
  try {
    environment = await generateEnvironment(battle);
  } catch {
    return Response.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }

  const updateResult = await supabase
    .from("battles")
    .update({ environment, updated_at: new Date().toISOString() })
    .eq("id", battleId)
    .select("id")
    .single();

  if (updateResult.error) {
    if (updateResult.error.code === "PGRST116") {
      return Response.json({ error: "Battle not found" }, { status: 404 });
    }
    return Response.json({ error: "Could not save environment. Please try again." }, { status: 500 });
  }

  return Response.json({ environment });
};
