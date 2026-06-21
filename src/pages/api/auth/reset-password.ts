import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { m } from "@/paraglide/messages.js";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return context.redirect("/auth/forgot-password");
  }

  const formData = await context.request.formData();
  const passwordValue = formData.get("password");
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const confirmPasswordValue = formData.get("confirm_password");
  const confirmPassword = typeof confirmPasswordValue === "string" ? confirmPasswordValue : "";

  if (!password || password.length < 6) {
    return context.redirect(`/auth/reset-password?error=${encodeURIComponent(m.api_err_password_min())}`);
  }

  if (password !== confirmPassword) {
    return context.redirect(`/auth/reset-password?error=${encodeURIComponent(m.validation_passwords_mismatch())}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/reset-password?error=${encodeURIComponent(m.api_err_service_unavailable_retry())}`);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return context.redirect(`/auth/reset-password?error=${encodeURIComponent(m.api_err_update_password())}`);
  }

  return context.redirect("/auth/signin?success=1");
};
