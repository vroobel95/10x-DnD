import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { getUserCampaigns } from "@/lib/campaigns";
import { m } from "@/paraglide/messages.js";
import type { Campaign } from "@/types";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: m.api_err_supabase() }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: m.api_err_unauthorized() }, { status: 401 });
  }

  const { data: campaigns, error } = await getUserCampaigns(supabase, user.id);
  if (error) {
    return Response.json({ error: m.api_err_load_campaigns() }, { status: 500 });
  }
  return Response.json({ campaigns });
};

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/campaigns/new?error=${encodeURIComponent(m.api_err_supabase())}`);
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const name = (form.get("name") as string | null)?.trim() ?? "";
  const descriptionRaw = (form.get("description") as string | null)?.trim() ?? "";
  const description = descriptionRaw !== "" ? descriptionRaw : null;

  if (!name) {
    return context.redirect(`/campaigns/new?error=${encodeURIComponent(m.api_err_campaign_name_required())}`);
  }
  if (name.length > 200) {
    return context.redirect(`/campaigns/new?error=${encodeURIComponent(m.api_err_campaign_name_too_long())}`);
  }
  if (description && description.length > 500) {
    return context.redirect(`/campaigns/new?error=${encodeURIComponent(m.api_err_description_too_long())}`);
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .insert({ user_id: user.id, name, description, updated_at: new Date().toISOString() })
    .select("*")
    .single<Campaign>();

  if (!campaign) {
    return context.redirect(`/campaigns/new?error=${encodeURIComponent(m.api_err_create_campaign())}`);
  }

  return context.redirect(`/campaigns/${campaign.id}`);
};
