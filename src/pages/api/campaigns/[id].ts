import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import type { Campaign } from "@/types";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = context.params;

  let body: { name?: string; description?: string };
  try {
    body = (await context.request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  if (!name) {
    return Response.json({ error: "Campaign name is required" }, { status: 400 });
  }
  if (name.length > 200) {
    return Response.json({ error: "Campaign name must be 200 characters or fewer" }, { status: 400 });
  }
  const description = body.description?.trim() ?? null;
  if (description && description.length > 500) {
    return Response.json({ error: "Description must be 500 characters or fewer" }, { status: 400 });
  }

  const { data: campaign } = (await supabase
    .from("campaigns")
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single()) as { data: Campaign | null };

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  return Response.json({ campaign });
};

export const DELETE: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = context.params;

  const { data } = await supabase.from("campaigns").delete().eq("id", id).eq("user_id", user.id).select("id").single();

  if (!data) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  return Response.json({ success: true });
};
