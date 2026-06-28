// @ts-check
/* global process */
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [
      tailwindcss(),
      paraglideVitePlugin({
        project: "./project.inlang",
        outdir: "./src/paraglide",
        strategy: ["cookie", "baseLocale"],
      }),
    ],
    optimizeDeps: {
      exclude: ["lucide-react"],
    },
    ssr: {
      noExternal: ["pdf-fontkit"],
      optimizeDeps: {
        esbuildOptions: {
          define: {
            "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
          },
        },
      },
    },
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      ANTHROPIC_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
