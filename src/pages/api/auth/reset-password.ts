import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

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
    return context.redirect(
      `/auth/reset-password?error=${encodeURIComponent("Password must be at least 6 characters")}`,
    );
  }

  if (password !== confirmPassword) {
    return context.redirect(`/auth/reset-password?error=${encodeURIComponent("Passwords do not match")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(
      `/auth/reset-password?error=${encodeURIComponent("Service unavailable. Please try again later.")}`,
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return context.redirect(
      `/auth/reset-password?error=${encodeURIComponent("Could not update password. Please try again.")}`,
    );
  }

  return context.redirect("/auth/signin?success=1");
};
