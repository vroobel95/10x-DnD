import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return context.redirect("/auth/forgot-password");
  }

  const formData = await context.request.formData();
  const password = formData.get("password")?.toString() ?? "";
  const confirmPassword = formData.get("confirm_password")?.toString() ?? "";

  if (password !== confirmPassword) {
    return context.redirect(
      `/auth/reset-password?error=${encodeURIComponent("Passwords do not match")}`,
    );
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (supabase) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error("updateUser error:", error.message);
      return context.redirect(
        `/auth/reset-password?error=${encodeURIComponent("Could not update password. Please try again.")}`,
      );
    }
  }

  return context.redirect("/auth/signin?success=1");
};
