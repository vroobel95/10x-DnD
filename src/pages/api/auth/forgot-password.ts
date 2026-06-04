import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const formData = await context.request.formData();
  const email = formData.get("email")?.toString() ?? "";

  const redirectTo = new URL("/api/auth/recovery-callback", context.request.url).href;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(
      `/auth/forgot-password?error=${encodeURIComponent("Service unavailable. Please try again later.")}`,
    );
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    console.error("resetPasswordForEmail error:", error.message);
    if (error.status === 429) {
      return context.redirect(
        `/auth/forgot-password?error=${encodeURIComponent("Please wait before trying again.")}`,
      );
    }
    if (error.status && error.status >= 500) {
      return context.redirect(
        `/auth/forgot-password?error=${encodeURIComponent("Something went wrong. Please try again.")}`,
      );
    }
  }

  return context.redirect("/auth/forgot-password?success=1");
};
