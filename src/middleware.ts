import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/battles", "/campaigns"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      context.locals.user = user ?? null;
    } catch {
      context.locals.user = null;
      const cookieHeader = context.request.headers.get("Cookie") ?? "";
      for (const chunk of cookieHeader.split(";")) {
        const name = chunk.trim().split("=")[0];
        if (name.startsWith("sb-")) {
          context.cookies.delete(name, { path: "/" });
        }
      }
    }
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
