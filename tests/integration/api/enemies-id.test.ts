import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { PATCH, DELETE } from "@/pages/api/enemies/[id]";
import { makeSupabaseMock } from "../../helpers/supabase";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

function makePatchContext({
  user = { id: "user-1" },
  id = "e-1",
}: { user?: { id: string } | null; id?: string } = {}): APIContext {
  return {
    request: new Request(`http://localhost/api/enemies/${id}`, { method: "PATCH" }),
    cookies: { set: vi.fn() },
    locals: { user },
    url: new URL(`http://localhost/api/enemies/${id}`),
    params: { id },
    redirect: vi.fn(),
  } as unknown as APIContext;
}

function makeDeleteContext({
  user = { id: "user-1" },
  id = "e-1",
}: { user?: { id: string } | null; id?: string } = {}): APIContext {
  return {
    request: new Request(`http://localhost/api/enemies/${id}`, { method: "DELETE" }),
    cookies: { set: vi.fn() },
    locals: { user },
    url: new URL(`http://localhost/api/enemies/${id}`),
    params: { id },
    redirect: vi.fn(),
  } as unknown as APIContext;
}

describe("PATCH /api/enemies/[id] (confirm)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 500 when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await PATCH(makePatchContext());
    expect(res.status).toBe(500);
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({ enemies: { data: null, error: null } }));
    const res = await PATCH(makePatchContext({ user: null }));
    expect(res.status).toBe(401);
  });

  it("returns 500 when supabase returns an error", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        campaigns: { data: [{ id: "camp-1" }], error: null },
        battles: { data: [{ id: "b-1" }], error: null },
        enemies: { data: null, error: { message: "DB error" } },
      }),
    );
    const res = await PATCH(makePatchContext());
    expect(res.status).toBe(500);
  });

  it("returns 404 when update returns no data", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        campaigns: { data: [{ id: "camp-1" }], error: null },
        battles: { data: [{ id: "b-1" }], error: null },
        enemies: { data: null, error: null },
      }),
    );
    const res = await PATCH(makePatchContext());
    expect(res.status).toBe(404);
  });

  it("returns 200 with enemy on successful confirm", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        campaigns: { data: [{ id: "camp-1" }], error: null },
        battles: { data: [{ id: "b-1" }], error: null },
        enemies: { data: { id: "e-1", status: "confirmed" }, error: null },
      }),
    );
    const res = await PATCH(makePatchContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("enemy");
    expect(body.enemy).toMatchObject({ id: "e-1", status: "confirmed" });
  });

  it("returns 404 when enemy does not belong to the authenticated user (IDOR)", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        campaigns: { data: [{ id: "camp-1" }], error: null },
        battles: { data: [], error: null },
      }),
    );
    const res = await PATCH(makePatchContext());
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/enemies/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 500 when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await DELETE(makeDeleteContext());
    expect(res.status).toBe(500);
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({ enemies: { data: [], error: null } }));
    const res = await DELETE(makeDeleteContext({ user: null }));
    expect(res.status).toBe(401);
  });

  it("returns 500 when supabase returns an error", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        campaigns: { data: [{ id: "camp-1" }], error: null },
        battles: { data: [{ id: "b-1" }], error: null },
        enemies: { data: null, error: { message: "DB error" } },
      }),
    );
    const res = await DELETE(makeDeleteContext());
    expect(res.status).toBe(500);
  });

  it("returns 404 when no row was deleted", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        campaigns: { data: [{ id: "camp-1" }], error: null },
        battles: { data: [{ id: "b-1" }], error: null },
        enemies: { data: [], error: null },
      }),
    );
    const res = await DELETE(makeDeleteContext());
    expect(res.status).toBe(404);
  });

  it("returns 200 with success on successful delete", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        campaigns: { data: [{ id: "camp-1" }], error: null },
        battles: { data: [{ id: "b-1" }], error: null },
        enemies: { data: [{ id: "e-1" }], error: null },
      }),
    );
    const res = await DELETE(makeDeleteContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("returns 404 when enemy does not belong to the authenticated user (IDOR)", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({
        campaigns: { data: [{ id: "camp-1" }], error: null },
        battles: { data: [], error: null },
      }),
    );
    const res = await DELETE(makeDeleteContext());
    expect(res.status).toBe(404);
  });
});
