import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const PATCH: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Service unavailable" }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: enemy, error } = await supabase
    .from("enemies")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", context.params.id)
    .select()
    .single();

  if (error || !enemy) {
    return Response.json({ error: "Enemy not found" }, { status: 404 });
  }

  return Response.json({ enemy });
};

export const DELETE: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Service unavailable" }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("enemies")
    .delete()
    .eq("id", context.params.id);

  if (error) {
    return Response.json({ error: "Could not delete enemy. Please try again." }, { status: 500 });
  }

  return Response.json({ success: true });
};
