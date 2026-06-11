import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import type { Enemy } from "@/types";
import { EnemySchema } from "@/lib/schemas/enemy";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Service unavailable" }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userCampaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("user_id", user.id);

  if (campaignsError) {
    return Response.json({ error: "Could not update enemy. Please try again." }, { status: 500 });
  }

  const campaignIds = userCampaigns.map((c: { id: string }) => c.id);

  if (campaignIds.length === 0) {
    return Response.json({ error: "Enemy not found" }, { status: 404 });
  }

  const { data: userBattles, error: battlesError } = await supabase
    .from("battles")
    .select("id")
    .in("campaign_id", campaignIds);

  if (battlesError) {
    return Response.json({ error: "Could not update enemy. Please try again." }, { status: 500 });
  }

  const battleIds = userBattles.map((b: { id: string }) => b.id);

  if (battleIds.length === 0) {
    return Response.json({ error: "Enemy not found" }, { status: 404 });
  }

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

  const { data: userCampaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("user_id", user.id);

  if (campaignsError) {
    return Response.json({ error: "Could not delete enemy. Please try again." }, { status: 500 });
  }

  const campaignIds = userCampaigns.map((c: { id: string }) => c.id);

  if (campaignIds.length === 0) {
    return Response.json({ error: "Enemy not found" }, { status: 404 });
  }

  const { data: userBattles, error: battlesError } = await supabase
    .from("battles")
    .select("id")
    .in("campaign_id", campaignIds);

  if (battlesError) {
    return Response.json({ error: "Could not delete enemy. Please try again." }, { status: 500 });
  }

  const battleIds = userBattles.map((b: { id: string }) => b.id);

  if (battleIds.length === 0) {
    return Response.json({ error: "Enemy not found" }, { status: 404 });
  }

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

  return Response.json({ success: true });
};
