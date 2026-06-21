import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { m } from "@/paraglide/messages.js";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const code = context.url.searchParams.get("code");

  if (code) {
    const supabase = createClient(context.request.headers, context.cookies);
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return context.redirect("/auth/reset-password");
      }
    }
  }

  return context.redirect(`/auth/forgot-password?error=${encodeURIComponent(m.auth_reset_link_invalid())}`);
};
