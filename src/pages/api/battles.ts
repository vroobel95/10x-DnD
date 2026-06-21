import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { m } from "@/paraglide/messages.js";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/battles/new?error=${encodeURIComponent(m.api_err_supabase())}`);
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const campaignId = (form.get("campaign_id") as string | null)?.trim() ?? "";

  if (!campaignId) {
    return context.redirect(`/campaigns?error=${encodeURIComponent(m.api_err_campaign_required())}`);
  }

  const ownedCampaignResult = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (ownedCampaignResult.error) {
    if (ownedCampaignResult.error.code === "PGRST116") {
      return context.redirect(`/campaigns?error=${encodeURIComponent(m.api_err_campaign_not_found())}`);
    }
    return context.redirect(`/campaigns?error=${encodeURIComponent(m.api_err_verify_campaign())}`);
  }

  const name = (form.get("name") as string | null)?.trim() ?? "";
  const partyLevelRaw = (form.get("party_level") as string | null) ?? "";
  const locationRaw = (form.get("location") as string | null)?.trim() ?? "";
  const location = locationRaw !== "" ? locationRaw : null;

  if (!name) {
    return context.redirect(
      `/battles/new?campaignId=${campaignId}&error=${encodeURIComponent(m.api_err_battle_name_required())}`,
    );
  }
  if (name.length > 200) {
    return context.redirect(
      `/battles/new?campaignId=${campaignId}&error=${encodeURIComponent(m.api_err_battle_name_too_long())}`,
    );
  }
  if (location && location.length > 200) {
    return context.redirect(
      `/battles/new?campaignId=${campaignId}&error=${encodeURIComponent(m.api_err_location_too_long())}`,
    );
  }

  let partyLevel: number | null = null;
  if (partyLevelRaw.trim() !== "") {
    const parsed = parseInt(partyLevelRaw, 10);
    if (isNaN(parsed) || parsed <= 0 || parsed > 30) {
      return context.redirect(
        `/battles/new?campaignId=${campaignId}&error=${encodeURIComponent(m.api_err_party_level_range())}`,
      );
    }
    partyLevel = parsed;
  }

  const { data: battle, error } = await supabase
    .from("battles")
    .insert({
      campaign_id: campaignId,
      name,
      party_level: partyLevel,
      location,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return context.redirect(
      `/battles/new?campaignId=${campaignId}&error=${encodeURIComponent(m.api_err_create_battle())}`,
    );
  }

  return context.redirect(`/battles/${battle.id}`);
};

export const GET: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: m.api_err_supabase() }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: m.api_err_unauthorized() }, { status: 401 });
  }

  const campaignId = context.url.searchParams.get("campaignId");
  if (!campaignId) {
    return Response.json({ error: m.api_err_campaignid_required() }, { status: 400 });
  }

  const ownedCampaignResult = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (ownedCampaignResult.error) {
    if (ownedCampaignResult.error.code === "PGRST116") {
      return Response.json({ error: m.api_err_campaign_not_found() }, { status: 404 });
    }
    return Response.json({ error: m.api_err_verify_campaign() }, { status: 500 });
  }

  const { data: battles, error } = await supabase
    .from("battles")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: m.api_err_load_battles() }, { status: 500 });
  }

  return Response.json({ battles });
};
