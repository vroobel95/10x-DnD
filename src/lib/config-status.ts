import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";
import { m } from "@/paraglide/messages.js";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  // Deferred getters so the message resolves in the active locale per-request,
  // not at module-evaluation time (when no request locale exists yet).
  message: () => string;
  docsUrl?: string;
  docsLabel?: () => string;
}

export const configStatuses: ConfigStatus[] = [
  {
    name: "Supabase",
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    message: () => m.config_supabase_missing(),
    docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
    docsLabel: () => m.config_supabase_docs(),
  },
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);
