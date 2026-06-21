import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { m } from "@/paraglide/messages.js";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const formData = await context.request.formData();
  const emailValue = formData.get("email");
  const email = typeof emailValue === "string" ? emailValue : "";

  const redirectTo = new URL("/api/auth/recovery-callback", context.request.url).href;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/forgot-password?error=${encodeURIComponent(m.api_err_service_unavailable_retry())}`);
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    if (error.status === 429) {
      return context.redirect(`/auth/forgot-password?error=${encodeURIComponent(m.api_err_rate_limit())}`);
    }
    if (error.status && error.status >= 500) {
      return context.redirect(`/auth/forgot-password?error=${encodeURIComponent(m.api_err_generic())}`);
    }
  }

  return context.redirect("/auth/forgot-password?success=1");
};
