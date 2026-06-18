import type { APIRoute } from "astro";

import { buildBattlePdf, pdfFilename } from "@/lib/pdf/battle-pdf";
import { createClient } from "@/lib/supabase";
import type { Enemy } from "@/types";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Service unavailable" }, { status: 500 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const battleId = context.params.id;

  const battleResult = await supabase.from("battles").select("id, name, campaign_id").eq("id", battleId).single();

  if (battleResult.error) {
    if (battleResult.error.code === "PGRST116") {
      return Response.json({ error: "Battle not found" }, { status: 404 });
    }
    return Response.json({ error: "Could not load battle. Please try again." }, { status: 500 });
  }

  const battle = battleResult.data;

  const campaignResult = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", battle.campaign_id)
    .eq("user_id", user.id)
    .single();

  if (campaignResult.error) {
    if (campaignResult.error.code === "PGRST116") {
      return Response.json({ error: "Battle not found" }, { status: 404 });
    }
    return Response.json({ error: "Could not load battle. Please try again." }, { status: 500 });
  }

  const enemiesResult = await supabase
    .from("enemies")
    .select("*")
    .eq("battle_id", battleId)
    .eq("status", "confirmed")
    .order("created_at");

  if (enemiesResult.error) {
    return Response.json({ error: "Could not load enemies. Please try again." }, { status: 500 });
  }

  const enemies = enemiesResult.data as Enemy[];

  if (enemies.length === 0) {
    return Response.json({ error: "No confirmed enemies to export" }, { status: 404 });
  }

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildBattlePdf(battle, enemies);
  } catch {
    return Response.json({ error: "Could not generate PDF. Please try again." }, { status: 500 });
  }

  // pdf-lib always returns a Uint8Array backed by a plain ArrayBuffer (never SharedArrayBuffer)
  const filename = pdfFilename(String(battle.name));
  return new Response(pdfBytes.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
};
