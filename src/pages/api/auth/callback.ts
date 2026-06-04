import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const GET: APIRoute = async (context) => {
  const code = context.url.searchParams.get("code");
  const raw = context.url.searchParams.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  if (code) {
    const supabase = createClient(context.request.headers, context.cookies);
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return context.redirect(next);
      }
    }
  }

  return context.redirect(`/auth/signin?error=${encodeURIComponent("Email confirmation failed. Please try again.")}`);
};
