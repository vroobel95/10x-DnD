import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { m } from "@/paraglide/messages.js";
import type { Battle } from "@/types";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: m.api_err_service_unavailable() }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: m.api_err_unauthorized() }, { status: 401 });
  }

  const { id } = context.params;

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: m.api_err_invalid_body() }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: m.api_err_invalid_body() }, { status: 400 });
  }

  const { name, party_level, location } = body as Record<string, unknown>;

  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (!trimmedName) {
    return Response.json({ error: m.api_err_battle_name_required() }, { status: 400 });
  }
  if (trimmedName.length > 200) {
    return Response.json({ error: m.api_err_battle_name_too_long() }, { status: 422 });
  }

  let partyLevel: number | null = null;
  if (party_level !== null && party_level !== undefined && party_level !== "") {
    if (typeof party_level !== "number" || !Number.isInteger(party_level) || party_level < 1 || party_level > 30) {
      return Response.json({ error: m.api_err_party_level_range() }, { status: 422 });
    }
    partyLevel = party_level;
  }

  let trimmedLocation: string | null = null;
  if (location !== null && location !== undefined && location !== "") {
    if (typeof location !== "string") {
      return Response.json({ error: m.api_err_location_string() }, { status: 422 });
    }
    const loc = location.trim();
    if (loc.length > 200) {
      return Response.json({ error: m.api_err_location_too_long() }, { status: 422 });
    }
    trimmedLocation = loc !== "" ? loc : null;
  }

  const { data: userCampaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("user_id", user.id);

  if (campaignsError) {
    return Response.json({ error: m.api_err_update_battle() }, { status: 500 });
  }

  const campaignIds = userCampaigns.map((c: { id: string }) => c.id);

  if (campaignIds.length === 0) {
    return Response.json({ error: m.api_err_battle_not_found() }, { status: 404 });
  }

  const result = await supabase
    .from("battles")
    .update({
      name: trimmedName,
      party_level: partyLevel,
      location: trimmedLocation,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("campaign_id", campaignIds)
    .select();

  if (result.error) {
    return Response.json({ error: m.api_err_update_battle() }, { status: 500 });
  }
  if (result.data.length === 0) {
    return Response.json({ error: m.api_err_battle_not_found() }, { status: 404 });
  }

  return Response.json({ battle: result.data[0] as Battle });
};

export const DELETE: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: m.api_err_service_unavailable() }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: m.api_err_unauthorized() }, { status: 401 });
  }

  const { id } = context.params;

  const { data: userCampaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("user_id", user.id);

  if (campaignsError) {
    return Response.json({ error: m.api_err_load_battles() }, { status: 500 });
  }

  const campaignIds = userCampaigns.map((c: { id: string }) => c.id);

  if (campaignIds.length === 0) {
    return Response.json({ error: m.api_err_battle_not_found() }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("battles")
    .delete()
    .eq("id", id)
    .in("campaign_id", campaignIds)
    .select("id, campaign_id");

  if (error) {
    return Response.json({ error: m.api_err_delete_battle() }, { status: 500 });
  }

  if (data.length === 0) {
    return Response.json({ error: m.api_err_battle_not_found() }, { status: 404 });
  }

  return Response.json({ success: true });
};
