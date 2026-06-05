import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { generateEnemies } from "@/lib/ai";
import { POST } from "@/pages/api/battles/[id]/generate";
import { makeSupabaseMock } from "../../helpers/supabase";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/ai", () => ({ generateEnemies: vi.fn() }));

const battleData = { id: "b-1", party_level: 3, location: "cave" };

const validEnemy = {
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
};

function makeContext(options: { user?: { id: string } | null; prompt?: string | null } = {}) {
  const user = "user" in options ? options.user : { id: "user-1" };
  const prompt = "prompt" in options ? options.prompt : "Generate two goblins for a cave ambush";
  const body = prompt !== null ? JSON.stringify({ prompt }) : JSON.stringify({});
  return {
    request: new Request("http://localhost/api/battles/b-1/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
    cookies: { set: vi.fn() },
    locals: { user },
    url: new URL("http://localhost/api/battles/b-1/generate"),
    params: { id: "b-1" },
  } as unknown as APIContext;
}

describe("POST /api/battles/[id]/generate", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 500 when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await POST(makeContext());
    expect(res.status).toBe(500);
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await POST(makeContext({ user: null }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when prompt is missing", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await POST(makeContext({ prompt: null }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when prompt is empty string", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await POST(makeContext({ prompt: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when prompt exceeds 2000 characters", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await POST(makeContext({ prompt: "x".repeat(2001) }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when battle is not found — confirms battle-lookup RISK fix", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({ battles: { data: null, error: { code: "PGRST116", message: "No rows found" } } }),
    );
    const res = await POST(makeContext());
    expect(res.status).toBe(404);
  });

  it("returns 500 when battle SELECT errors with a non-not-found error", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({ battles: { data: null, error: { code: "23505", message: "DB error" } } }),
    );
    const res = await POST(makeContext());
    expect(res.status).toBe(500);
  });

  it("returns 500 with safe message when generateEnemies throws", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({ battles: { data: battleData, error: null } }));
    vi.mocked(generateEnemies).mockRejectedValue(new Error("Anthropic API error"));
    const res = await POST(makeContext());
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Generation failed. Please try again.");
  });

  it("does not call enemies insert when generateEnemies throws", async () => {
    const supabaseMock = makeSupabaseMock({ battles: { data: battleData, error: null } });
    vi.mocked(createClient).mockReturnValue(supabaseMock);
    vi.mocked(generateEnemies).mockRejectedValue(new Error("Anthropic API error"));
    await POST(makeContext());
    expect(supabaseMock.from).not.toHaveBeenCalledWith("enemies");
  });

  it("returns 500 when enemies insert errors", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        battles: { data: battleData, error: null },
        enemies: { data: null, error: { message: "Insert failed" } },
      }),
    );
    vi.mocked(generateEnemies).mockResolvedValue({ enemies: [validEnemy] });
    const res = await POST(makeContext());
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Could not save enemies. Please try again.");
  });

  it("returns 200 with enemies on success", async () => {
    const insertedEnemies = [{ id: "e-1", name: "Goblin", battle_id: "b-1" }];
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        battles: { data: battleData, error: null },
        enemies: { data: insertedEnemies, error: null },
      }),
    );
    vi.mocked(generateEnemies).mockResolvedValue({ enemies: [validEnemy] });
    const res = await POST(makeContext());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { enemies: unknown[] };
    expect(body.enemies).toHaveLength(1);
  });
});
