import { vi } from "vitest";

vi.mock("astro:env/server", () => ({
  SUPABASE_URL: "https://mock.supabase.co",
  SUPABASE_KEY: "mock-supabase-key",
  ANTHROPIC_API_KEY: "mock-anthropic-key",
}));
