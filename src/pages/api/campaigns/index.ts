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

  const { data: campaigns, error } = await getUserCampaigns(supabase, user.id);
  if (error) {
    return Response.json({ error: "Could not load campaigns" }, { status: 500 });
  }
  return Response.json({ campaigns });
};

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let name: string;
  let description: string | null;

  try {
    const body = await context.request.json() as { name?: string; description?: string };
    name = body.name?.trim() ?? "";
    description = body.description?.trim() || null;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!name) {
    return Response.json({ error: "Campaign name is required" }, { status: 400 });
  }
  if (name.length > 200) {
    return Response.json({ error: "Campaign name must be 200 characters or fewer" }, { status: 400 });
  }
  if (description && description.length > 500) {
    return Response.json({ error: "Description must be 500 characters or fewer" }, { status: 400 });
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({ user_id: user.id, name, description, updated_at: new Date().toISOString() })
    .select("*")
    .single();

  if (error || !campaign) {
    return Response.json({ error: "Could not create campaign. Please try again." }, { status: 500 });
  }

  return Response.json({ campaign });
};
