import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { getUserCampaigns } from "@/lib/campaigns";

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

  const campaigns = await getUserCampaigns(supabase, user.id);
  return Response.json({ campaigns });
};

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/campaigns?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const name = (form.get("name") as string | null)?.trim() ?? "";
  const description = (form.get("description") as string | null)?.trim() || null;

  if (!name) {
    return context.redirect(`/campaigns?error=${encodeURIComponent("Campaign name is required")}`);
  }
  if (name.length > 200) {
    return context.redirect(`/campaigns?error=${encodeURIComponent("Campaign name must be 200 characters or fewer")}`);
  }
  if (description && description.length > 500) {
    return context.redirect(`/campaigns?error=${encodeURIComponent("Description must be 500 characters or fewer")}`);
  }

  const { error } = await supabase.from("campaigns").insert({
    user_id: user.id,
    name,
    description,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return context.redirect(`/campaigns?error=${encodeURIComponent("Could not create campaign. Please try again.")}`);
  }

  return context.redirect("/campaigns");
};
