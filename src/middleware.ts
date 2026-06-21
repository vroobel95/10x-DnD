import { defineMiddleware, sequence } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import { paraglideMiddleware } from "@/paraglide/server.js";

const PROTECTED_ROUTES = ["/battles", "/campaigns"];

// Resolve the active locale (cookie strategy) and run the rest of the request
// inside Paraglide's AsyncLocalStorage scope so getLocale()/m.*() work in SSR.
// Pass Paraglide's (cloned) request to next() — using the original request instead
// disturbs its body stream and breaks request.formData() in POST endpoints.
const i18nMiddleware = defineMiddleware((context, next) =>
  paraglideMiddleware(context.request, ({ request }) => next(request)),
);

const authMiddleware = defineMiddleware(async (context, next) => {
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

export const onRequest = sequence(i18nMiddleware, authMiddleware);
