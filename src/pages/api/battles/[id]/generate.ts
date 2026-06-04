import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
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
    const body = (await context.request.json()) as { prompt?: string };
    prompt = body.prompt?.trim() ?? "";
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (prompt.length > 2000) {
    return Response.json({ error: "Prompt is too long (max 2000 characters)" }, { status: 400 });
  }

  const battleResult = await supabase.from("battles").select("id, party_level, location").eq("id", battleId).single();

  if (battleResult.error) {
    if (battleResult.error.code === "PGRST116") {
      return Response.json({ error: "Battle not found" }, { status: 404 });
    }
    return Response.json({ error: "Could not load battle. Please try again." }, { status: 500 });
  }

  const battle = battleResult.data;

  let enemyGroup: Awaited<ReturnType<typeof generateEnemies>>;
  try {
    enemyGroup = await generateEnemies(battle, prompt);
  } catch {
    return Response.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }

  const rows = enemyGroup.enemies.map((e) => ({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    battle_id: battle.id,
    name: e.name,
    status: "pending" as const,
    stats: e,
  }));

  const insertResult = await supabase.from("enemies").insert(rows).select();

  if (insertResult.error) {
    return Response.json({ error: "Could not save enemies. Please try again." }, { status: 500 });
  }

  return Response.json({ enemies: insertResult.data as unknown[] });
};
