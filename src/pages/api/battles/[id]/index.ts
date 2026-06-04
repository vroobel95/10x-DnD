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

  const { data: userCampaigns } = await supabase.from("campaigns").select("id").eq("user_id", user.id);
  const campaignIds = (userCampaigns ?? []).map((c: { id: string }) => c.id);

  if (campaignIds.length === 0) {
    return Response.json({ error: "Battle not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("battles")
    .delete()
    .eq("id", id)
    .in("campaign_id", campaignIds)
    .select("id, campaign_id");

  if (error) {
    return Response.json({ error: "Could not delete battle. Please try again." }, { status: 500 });
  }

  if (data.length === 0) {
    return Response.json({ error: "Battle not found" }, { status: 404 });
  }

  return Response.json({ success: true });
};
