import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { m } from "@/paraglide/messages.js";
import type { Campaign } from "@/types";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: m.api_err_supabase() }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: m.api_err_unauthorized() }, { status: 401 });
  }

  const { id } = context.params;

  let body: { name?: string; description?: string };
  try {
    body = (await context.request.json()) as typeof body;
  } catch {
    return Response.json({ error: m.api_err_invalid_body() }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  if (!name) {
    return Response.json({ error: m.api_err_campaign_name_required() }, { status: 400 });
  }
  if (name.length > 200) {
    return Response.json({ error: m.api_err_campaign_name_too_long() }, { status: 400 });
  }
  const description = body.description?.trim() ?? null;
  if (description && description.length > 500) {
    return Response.json({ error: m.api_err_description_too_long() }, { status: 400 });
  }

  const updateResult = await supabase
    .from("campaigns")
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (updateResult.error) {
    if (updateResult.error.code === "PGRST116") {
      return Response.json({ error: m.api_err_campaign_not_found() }, { status: 404 });
    }
    return Response.json({ error: m.api_err_update_campaign() }, { status: 500 });
  }

  return Response.json({ campaign: updateResult.data as Campaign });
};

export const DELETE: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: m.api_err_supabase() }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: m.api_err_unauthorized() }, { status: 401 });
  }

  const { id } = context.params;

  const { data, error } = await supabase.from("campaigns").delete().eq("id", id).eq("user_id", user.id).select("id");

  if (error) {
    return Response.json({ error: m.api_err_delete_campaign() }, { status: 500 });
  }

  if (data.length === 0) {
    return Response.json({ error: m.api_err_campaign_not_found() }, { status: 404 });
  }

  return Response.json({ success: true });
};
