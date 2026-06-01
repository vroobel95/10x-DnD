import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const GET: APIRoute = async (context) => {
  const code = context.url.searchParams.get("code");
  const next = context.url.searchParams.get("next") ?? "/";
  const type = context.url.searchParams.get("type");

  if (code) {
    const supabase = createClient(context.request.headers, context.cookies);
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return context.redirect(next);
      }
    }
  }

  if (type === "recovery") {
    return context.redirect(
      `/auth/forgot-password?error=${encodeURIComponent("Reset link is invalid or has expired")}`,
    );
  }

  return context.redirect(`/auth/signin?error=${encodeURIComponent("Email confirmation failed. Please try again.")}`);
};
