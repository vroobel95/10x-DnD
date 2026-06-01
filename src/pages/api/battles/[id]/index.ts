import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

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

  const { data, error } = await supabase
    .from("battles")
    .delete()
    .eq("id", id)
    .select("id, campaign_id")
    .single();

  if (error || !data) {
    return Response.json({ error: "Battle not found" }, { status: 404 });
  }

  return Response.json({ success: true });
};
