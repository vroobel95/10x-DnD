import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const formData = await context.request.formData();
  const email = formData.get("email")?.toString() ?? "";

  const redirectTo = new URL(
    `/api/auth/callback?next=/auth/reset-password&type=recovery`,
    context.request.url,
  ).href;

  const supabase = createClient(context.request.headers, context.cookies);
  if (supabase) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      console.error("resetPasswordForEmail error:", error.message);
      // Only surface genuine server/config errors; treat user-not-found as success to prevent enumeration
      if (error.status && error.status >= 500) {
        return context.redirect(
          `/auth/forgot-password?error=${encodeURIComponent("Something went wrong. Please try again.")}`,
        );
      }
    }
  }

  return context.redirect("/auth/forgot-password?success=1");
};
