import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/battles/new?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const campaignId = (form.get("campaign_id") as string | null)?.trim() ?? "";

  if (!campaignId) {
    return context.redirect(`/campaigns?error=${encodeURIComponent("Campaign is required")}`);
  }

  const ownedCampaignResult = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (ownedCampaignResult.error) {
    if (ownedCampaignResult.error.code === "PGRST116") {
      return context.redirect(`/campaigns?error=${encodeURIComponent("Campaign not found")}`);
    }
    return context.redirect(`/campaigns?error=${encodeURIComponent("Could not verify campaign. Please try again.")}`);
  }

  const name = (form.get("name") as string | null)?.trim() ?? "";
  const partyLevelRaw = (form.get("party_level") as string | null) ?? "";
  const locationRaw = (form.get("location") as string | null)?.trim() ?? "";
  const location = locationRaw !== "" ? locationRaw : null;

  if (!name) {
    return context.redirect(
      `/battles/new?campaignId=${campaignId}&error=${encodeURIComponent("Battle name is required")}`,
    );
  }
  if (name.length > 200) {
    return context.redirect(
      `/battles/new?campaignId=${campaignId}&error=${encodeURIComponent("Battle name must be 200 characters or fewer")}`,
    );
  }
  if (location && location.length > 200) {
    return context.redirect(
      `/battles/new?campaignId=${campaignId}&error=${encodeURIComponent("Location must be 200 characters or fewer")}`,
    );
  }

  let partyLevel: number | null = null;
  if (partyLevelRaw.trim() !== "") {
    const parsed = parseInt(partyLevelRaw, 10);
    if (isNaN(parsed) || parsed <= 0 || parsed > 30) {
      return context.redirect(
        `/battles/new?campaignId=${campaignId}&error=${encodeURIComponent("Party level must be between 1 and 30")}`,
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
      `/battles/new?campaignId=${campaignId}&error=${encodeURIComponent("Could not create battle. Please try again.")}`,
    );
  }

  return context.redirect(`/battles/${battle.id}`);
};

export const GET: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaignId = context.url.searchParams.get("campaignId");
  if (!campaignId) {
    return Response.json({ error: "campaignId required" }, { status: 400 });
  }

  const ownedCampaignResult = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (ownedCampaignResult.error) {
    if (ownedCampaignResult.error.code === "PGRST116") {
      return Response.json({ error: "Campaign not found" }, { status: 404 });
    }
    return Response.json({ error: "Could not verify campaign. Please try again." }, { status: 500 });
  }

  const { data: battles, error } = await supabase
    .from("battles")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: "Could not load battles. Please try again." }, { status: 500 });
  }

  return Response.json({ battles });
};
