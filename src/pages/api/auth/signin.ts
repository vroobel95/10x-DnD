import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { m } from "@/paraglide/messages.js";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email");
  const password = form.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(m.api_err_signin_failed())}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(m.api_err_supabase())}`);
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(m.api_err_signin_failed())}`);
  }

  return context.redirect("/");
};
