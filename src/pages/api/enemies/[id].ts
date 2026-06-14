import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import type { Enemy } from "@/types";
import { EnemySchema } from "@/lib/schemas/enemy";

export const prerender = false;

type BattleIdsResult = { battleIds: string[]; errorResponse: null } | { battleIds: null; errorResponse: Response };

async function resolveUserBattleIds(
  supabase: Exclude<ReturnType<typeof createClient>, null>,
  userId: string,
  actionError: string,
): Promise<BattleIdsResult> {
  const { data: userCampaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("user_id", userId);

  if (campaignsError) {
    return { battleIds: null, errorResponse: Response.json({ error: actionError }, { status: 500 }) };
  }

  const campaignIds = (userCampaigns as { id: string }[]).map((c) => c.id);

  if (campaignIds.length === 0) {
    return { battleIds: null, errorResponse: Response.json({ error: "Enemy not found" }, { status: 404 }) };
  }

  const { data: userBattles, error: battlesError } = await supabase
    .from("battles")
    .select("id")
    .in("campaign_id", campaignIds);

  if (battlesError) {
    return { battleIds: null, errorResponse: Response.json({ error: actionError }, { status: 500 }) };
  }

  const battleIds = (userBattles as { id: string }[]).map((b) => b.id);

  if (battleIds.length === 0) {
    return { battleIds: null, errorResponse: Response.json({ error: "Enemy not found" }, { status: 404 }) };
  }

  return { battleIds, errorResponse: null };
}

export const PATCH: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Service unavailable" }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authResult = await resolveUserBattleIds(supabase, user.id, "Could not update enemy. Please try again.");
  if (authResult.errorResponse) return authResult.errorResponse;
  const { battleIds } = authResult;

  const isJson = context.request.headers.get("content-type")?.includes("application/json");

  if (isJson) {
    let body: unknown;
    try {
      body = await context.request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (typeof body === "object" && body !== null && "stats" in body) {
      const parsed = EnemySchema.safeParse(body.stats);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Invalid stats";
        return Response.json({ error: message }, { status: 422 });
      }

      const result = await supabase
        .from("enemies")
        .update({
          stats: parsed.data,
          name: parsed.data.name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", context.params.id)
        .in("battle_id", battleIds)
        .select()
        .single();

      if (result.error) {
        return Response.json({ error: "Could not update enemy. Please try again." }, { status: 500 });
      }
      if (!result.data) {
        return Response.json({ error: "Enemy not found" }, { status: 404 });
      }

      return Response.json({ enemy: result.data as Enemy });
    }
  }

  // Bare PATCH (no Content-Type: application/json) is the confirm contract — see EnemiesSection.tsx:53.
  const result = await supabase
    .from("enemies")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", context.params.id)
    .in("battle_id", battleIds)
    .select()
    .single();

  if (result.error) {
    return Response.json({ error: "Could not update enemy. Please try again." }, { status: 500 });
  }
  if (!result.data) {
    return Response.json({ error: "Enemy not found" }, { status: 404 });
  }

  return Response.json({ enemy: result.data as Enemy });
};

export const DELETE: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Service unavailable" }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authResult = await resolveUserBattleIds(supabase, user.id, "Could not delete enemy. Please try again.");
  if (authResult.errorResponse) return authResult.errorResponse;
  const { battleIds } = authResult;

  // Must run before the delete: FK cascade clears main_enemy_id automatically, but not the
  // companion JSONB column. If this update succeeds but the delete below fails, the battle
  // temporarily loses its villain reference while the enemy still exists — acceptable edge case.
  const profileClearResult = await supabase
    .from("battles")
    .update({ main_enemy_id: null, main_enemy_profile: null, updated_at: new Date().toISOString() })
    .eq("main_enemy_id", context.params.id)
    .select("id");

  const mainEnemyCleared = !profileClearResult.error && profileClearResult.data.length > 0;

  const deleteResult = await supabase
    .from("enemies")
    .delete()
    .eq("id", context.params.id)
    .in("battle_id", battleIds)
    .select("id");

  if (deleteResult.error) {
    return Response.json({ error: "Could not delete enemy. Please try again." }, { status: 500 });
  }

  if (deleteResult.data.length === 0) {
    return Response.json({ error: "Enemy not found" }, { status: 404 });
  }

  return Response.json({ success: true, main_enemy_cleared: mainEnemyCleared });
};
