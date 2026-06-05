import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { DELETE } from "@/pages/api/battles/[id]/index";
import { makeSupabaseMock } from "../../helpers/supabase";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

function makeContext(options: { user?: { id: string } | null; id?: string } = {}) {
  const user = "user" in options ? options.user : { id: "user-1" };
  const id = options.id ?? "b-1";
  return {
    request: new Request(`http://localhost/api/battles/${id}`, { method: "DELETE" }),
    cookies: { set: vi.fn() },
    locals: { user },
    url: new URL(`http://localhost/api/battles/${id}`),
    params: { id },
  } as unknown as APIContext;
}

describe("DELETE /api/battles/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 500 when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await DELETE(makeContext());
    expect(res.status).toBe(500);
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await DELETE(makeContext({ user: null }));
    expect(res.status).toBe(401);
  });

  it("returns 500 when campaigns query errors", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({ campaigns: { data: null, error: { message: "DB error" } } }),
    );
    const res = await DELETE(makeContext());
    expect(res.status).toBe(500);
  });

  it("returns 404 when user has no campaigns", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({ campaigns: { data: [], error: null } }));
    const res = await DELETE(makeContext());
    expect(res.status).toBe(404);
  });

  it("returns 500 when battle DELETE errors — confirms RISK fix", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        campaigns: { data: [{ id: "camp-1" }], error: null },
        battles: { data: null, error: { message: "DB error" } },
      }),
    );
    const res = await DELETE(makeContext());
    expect(res.status).toBe(500);
  });

  it("returns 404 when battle is not found", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        campaigns: { data: [{ id: "camp-1" }], error: null },
        battles: { data: [], error: null },
      }),
    );
    const res = await DELETE(makeContext());
    expect(res.status).toBe(404);
  });

  it("returns 200 with success:true on successful delete", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        campaigns: { data: [{ id: "camp-1" }], error: null },
        battles: { data: [{ id: "b-1", campaign_id: "camp-1" }], error: null },
      }),
    );
    const res = await DELETE(makeContext());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });
});
