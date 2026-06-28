import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as battlePdf from "@/lib/pdf/battle-pdf";
import { createClient } from "@/lib/supabase";
import { GET } from "@/pages/api/battles/[id]/export.pdf";
import { makeSupabaseMock } from "../../helpers/supabase";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

const battleData = { id: "b-1", name: "Frozen Cave Ambush", campaign_id: "camp-1" };

const validEnemyRow = {
  id: "e-1",
  battle_id: "b-1",
  name: "Goblin",
  status: "confirmed",
  stats: {
    name: "Goblin",
    cr: "1/4",
    hp: 7,
    ac: 15,
    speed: "30 ft.",
    str: 8,
    dex: 14,
    con: 10,
    int: 10,
    wis: 8,
    cha: 8,
    abilities: [],
  },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

function makeContext(options: { user?: { id: string } | null; locale?: string } = {}) {
  const user = "user" in options ? options.user : { id: "user-1" };
  const locale = options.locale;
  return {
    request: new Request("http://localhost/api/battles/b-1/export.pdf"),
    cookies: {
      set: vi.fn(),
      get: vi.fn((name: string) => (name === "PARAGLIDE_LOCALE" && locale ? { value: locale } : undefined)),
    },
    locals: { user },
    url: new URL("http://localhost/api/battles/b-1/export.pdf"),
    params: { id: "b-1" },
  } as unknown as APIContext;
}

describe("GET /api/battles/[id]/export.pdf", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 500 when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await GET(makeContext());
    expect(res.status).toBe(500);
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await GET(makeContext({ user: null }));
    expect(res.status).toBe(401);
  });

  it("returns 404 when battle is not found (PGRST116)", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        battles: { data: null, error: { code: "PGRST116", message: "No rows found" } },
      }),
    );
    const res = await GET(makeContext());
    expect(res.status).toBe(404);
  });

  it("returns 500 on a non-not-found battle SELECT error", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        battles: { data: null, error: { code: "23505", message: "DB error" } },
      }),
    );
    const res = await GET(makeContext());
    expect(res.status).toBe(500);
  });

  it("returns 404 when battle does not belong to the authenticated user (IDOR)", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        battles: { data: battleData, error: null },
        campaigns: { data: null, error: { code: "PGRST116", message: "No rows found" } },
      }),
    );
    const res = await GET(makeContext());
    expect(res.status).toBe(404);
  });

  it("returns 500 on a non-not-found campaign SELECT error", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        battles: { data: battleData, error: null },
        campaigns: { data: null, error: { code: "23505", message: "DB error" } },
      }),
    );
    const res = await GET(makeContext());
    expect(res.status).toBe(500);
  });

  it("returns 404 when there are no confirmed enemies", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        battles: { data: battleData, error: null },
        campaigns: { data: { id: "camp-1" }, error: null },
        enemies: { data: [], error: null },
      }),
    );
    const res = await GET(makeContext());
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("No confirmed enemies to export");
  });

  it("returns 500 when buildBattlePdf throws internally", async () => {
    const spy = vi.spyOn(battlePdf, "buildBattlePdf").mockRejectedValueOnce(new Error("PDF generation failed"));
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        battles: { data: battleData, error: null },
        campaigns: { data: { id: "camp-1" }, error: null },
        enemies: { data: [validEnemyRow], error: null },
      }),
    );
    const res = await GET(makeContext());
    expect(res.status).toBe(500);
    spy.mockRestore();
  });

  it("returns 200 with PDF headers and %PDF- body on success", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        battles: { data: battleData, error: null },
        campaigns: { data: { id: "camp-1" }, error: null },
        enemies: { data: [validEnemyRow], error: null },
      }),
    );
    const res = await GET(makeContext());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment;\s*filename\*?=/);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("exports a valid PDF when the battle has an environment", async () => {
    const battleWithEnv = {
      ...battleData,
      environment: {
        terrain: "Frozen lake",
        lighting: "Dim blue glow",
        hazards: "Cracking ice",
        ambiance: "Groaning cavern",
        trivia: "Old smuggler cache",
      },
    };
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        battles: { data: battleWithEnv, error: null },
        campaigns: { data: { id: "camp-1" }, error: null },
        enemies: { data: [validEnemyRow], error: null },
      }),
    );
    const res = await GET(makeContext());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("exports a valid PDF when the battle has no environment", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        battles: { data: { ...battleData, environment: null }, error: null },
        campaigns: { data: { id: "camp-1" }, error: null },
        enemies: { data: [validEnemyRow], error: null },
      }),
    );
    const res = await GET(makeContext());
    expect(res.status).toBe(200);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});
