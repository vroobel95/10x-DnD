import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { getUserCampaign } from "@/lib/campaigns";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/battles/new?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const campaign = await getUserCampaign(supabase, user.id);

  if (!campaign) {
    return context.redirect(
      `/battles/new?error=${encodeURIComponent("No campaign found — please sign out and sign back in")}`,
    );
  }

  const form = await context.request.formData();
  const name = (form.get("name") as string | null)?.trim() ?? "";
  const partyLevelRaw = (form.get("party_level") as string | null) ?? "";
  const locationRaw = (form.get("location") as string | null)?.trim() ?? "";
  const location = locationRaw !== "" ? locationRaw : null;

  if (!name) {
    return context.redirect(`/battles/new?error=${encodeURIComponent("Battle name is required")}`);
  }
  if (name.length > 200) {
    return context.redirect(`/battles/new?error=${encodeURIComponent("Battle name must be 200 characters or fewer")}`);
  }
  if (location && location.length > 200) {
    return context.redirect(`/battles/new?error=${encodeURIComponent("Location must be 200 characters or fewer")}`);
  }

  let partyLevel: number | null = null;
  if (partyLevelRaw.trim() !== "") {
    const parsed = parseInt(partyLevelRaw, 10);
    if (isNaN(parsed) || parsed <= 0 || parsed > 30) {
      return context.redirect(`/battles/new?error=${encodeURIComponent("Party level must be between 1 and 30")}`);
    }
    partyLevel = parsed;
  }

  const { data: battle, error } = await supabase
    .from("battles")
    .insert({
      campaign_id: campaign.id,
      name,
      party_level: partyLevel,
      location,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return context.redirect(`/battles/new?error=${encodeURIComponent("Could not create battle. Please try again.")}`);
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

  const campaign = await getUserCampaign(supabase, user.id);

  if (!campaign) {
    return Response.json({ battles: [] });
  }

  const { data: battles } = await supabase
    .from("battles")
    .select("*")
    .eq("campaign_id", campaign.id)
    .order("created_at", { ascending: false });

  return Response.json({ battles: battles ?? [] });
};
