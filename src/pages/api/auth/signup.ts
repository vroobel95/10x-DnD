import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { m } from "@/paraglide/messages.js";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email");
  const password = form.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(m.api_err_create_account())}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(m.api_err_supabase())}`);
  }
  const callbackUrl = new URL("/api/auth/callback", context.request.url).href;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl },
  });

  if (error) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(m.api_err_create_account())}`);
  }

  return context.redirect("/auth/confirm-email");
};
