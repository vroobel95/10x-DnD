import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { generateEnemies } from "@/lib/ai";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { BattleEnvironment, MainEnemyProfile } from "@/types";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: m.api_err_service_unavailable() }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: m.api_err_unauthorized() }, { status: 401 });
  }

  const battleId = context.params.id;

  let prompt: string;
  try {
    const body = (await context.request.json()) as { prompt?: string };
    prompt = body.prompt?.trim() ?? "";
  } catch {
    return Response.json({ error: m.api_err_invalid_body() }, { status: 400 });
  }

  if (!prompt) {
    return Response.json({ error: m.api_err_prompt_required() }, { status: 400 });
  }

  if (prompt.length > 2000) {
    return Response.json({ error: m.api_err_prompt_too_long() }, { status: 400 });
  }

  const battleResult = await supabase
    .from("battles")
    .select("id, party_level, location, campaign_id, environment, main_enemy_id")
    .eq("id", battleId)
    .single();

  if (battleResult.error) {
    if (battleResult.error.code === "PGRST116") {
      return Response.json({ error: m.api_err_battle_not_found() }, { status: 404 });
    }
    return Response.json({ error: m.api_err_load_battle() }, { status: 500 });
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
      return Response.json({ error: m.api_err_battle_not_found() }, { status: 404 });
    }
    return Response.json({ error: m.api_err_load_battle() }, { status: 500 });
  }

  let enemyGroup: Awaited<ReturnType<typeof generateEnemies>>;
  try {
    enemyGroup = await generateEnemies(
      { ...battle, environment: battle.environment as BattleEnvironment | null },
      prompt,
      getLocale(),
    );
  } catch {
    return Response.json({ error: m.err_generation_failed() }, { status: 500 });
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
    return Response.json({ error: m.api_err_save_enemies() }, { status: 500 });
  }

  let mainEnemyId: string | null = null;
  let mainEnemyProfile: MainEnemyProfile | null = null;

  if (enemyGroup.main_enemy && !battle.main_enemy_id) {
    const mainEnemy = enemyGroup.main_enemy;
    const insertedRows = insertResult.data as { id: string; name: string }[];
    const mainRow = insertedRows.find((r) => r.name.trim().toLowerCase() === mainEnemy.enemy_name.trim().toLowerCase());
    if (mainRow) {
      const profileUpdateResult = await supabase
        .from("battles")
        .update({
          main_enemy_id: mainRow.id,
          main_enemy_profile: mainEnemy.profile,
          updated_at: new Date().toISOString(),
        })
        .eq("id", battleId);
      if (!profileUpdateResult.error) {
        mainEnemyId = mainRow.id;
        mainEnemyProfile = mainEnemy.profile;
      }
    }
  }

  return Response.json({
    enemies: insertResult.data as unknown[],
    main_enemy_id: mainEnemyId,
    main_enemy_profile: mainEnemyProfile,
  });
};
