import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { getUserCampaigns } from "@/lib/campaigns";
import type { Campaign } from "@/types";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: campaigns, error } = await getUserCampaigns(supabase, user.id);
  if (error) {
    return Response.json({ error: "Could not load campaigns" }, { status: 500 });
  }
  return Response.json({ campaigns });
};

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/campaigns/new?error=${encodeURIComponent("Supabase is not configured")}`);
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
    return context.redirect(`/campaigns/new?error=${encodeURIComponent("Campaign name is required")}`);
  }
  if (name.length > 200) {
    return context.redirect(
      `/campaigns/new?error=${encodeURIComponent("Campaign name must be 200 characters or fewer")}`,
    );
  }
  if (description && description.length > 500) {
    return context.redirect(
      `/campaigns/new?error=${encodeURIComponent("Description must be 500 characters or fewer")}`,
    );
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .insert({ user_id: user.id, name, description, updated_at: new Date().toISOString() })
    .select("*")
    .single<Campaign>();

  if (!campaign) {
    return context.redirect(
      `/campaigns/new?error=${encodeURIComponent("Could not create campaign. Please try again.")}`,
    );
  }

  return context.redirect(`/campaigns/${campaign.id}`);
};
