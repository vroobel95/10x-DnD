import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { GET } from "@/pages/api/battles";
import { makeSupabaseMock } from "../../helpers/supabase";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

function makeContext(options: { user?: { id: string } | null; campaignId?: string | null } = {}) {
  const user = "user" in options ? options.user : { id: "user-1" };
  const campaignId = "campaignId" in options ? options.campaignId : "camp-1";
  const urlStr = campaignId ? `http://localhost/api/battles?campaignId=${campaignId}` : "http://localhost/api/battles";
  return {
    request: new Request(urlStr),
    cookies: { set: vi.fn() },
    locals: { user },
    url: new URL(urlStr),
    params: {},
  } as unknown as APIContext;
}

describe("GET /api/battles", () => {
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

  it("returns 400 when campaignId is missing", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await GET(makeContext({ campaignId: null }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when campaign ownership check fails", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({ campaigns: { data: null, error: { code: "PGRST116", message: "No rows found" } } }),
    );
    const res = await GET(makeContext());
    expect(res.status).toBe(404);
  });

  it("returns 500 when battles SELECT errors — confirms bug fix", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        campaigns: { data: { id: "camp-1" }, error: null },
        battles: { data: null, error: { message: "connection refused" } },
      }),
    );
    const res = await GET(makeContext());
    expect(res.status).toBe(500);
  });

  it("returns 200 with battles array on success", async () => {
    const battleList = [{ id: "b-1", name: "Cave Ambush", campaign_id: "camp-1" }];
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        campaigns: { data: { id: "camp-1" }, error: null },
        battles: { data: battleList, error: null },
      }),
    );
    const res = await GET(makeContext());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { battles: unknown[] };
    expect(body.battles).toHaveLength(1);
  });
});
