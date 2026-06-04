import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { PATCH, DELETE } from "@/pages/api/campaigns/[id]";
import { makeSupabaseMock } from "../../helpers/supabase";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

function makePatchContext(user: { id: string } | null = { id: "user-1" }, body: object = { name: "Updated Campaign" }) {
  return {
    request: new Request("http://localhost/api/campaigns/camp-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    cookies: { set: vi.fn() },
    locals: { user },
    url: new URL("http://localhost/api/campaigns/camp-1"),
    params: { id: "camp-1" },
  } as unknown as APIContext;
}

function makeDeleteContext(user: { id: string } | null = { id: "user-1" }) {
  return {
    request: new Request("http://localhost/api/campaigns/camp-1", { method: "DELETE" }),
    cookies: { set: vi.fn() },
    locals: { user },
    url: new URL("http://localhost/api/campaigns/camp-1"),
    params: { id: "camp-1" },
  } as unknown as APIContext;
}

describe("PATCH /api/campaigns/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 500 when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await PATCH(makePatchContext());
    expect(res.status).toBe(500);
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await PATCH(makePatchContext(null));
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await PATCH(makePatchContext({ id: "user-1" }, {}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is empty string", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await PATCH(makePatchContext({ id: "user-1" }, { name: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 when campaigns UPDATE errors — confirms RISK fix", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({ campaigns: { data: null, error: { message: "DB error" } } }),
    );
    const res = await PATCH(makePatchContext());
    expect(res.status).toBe(500);
  });

  it("returns 404 when campaign is not found", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({ campaigns: { data: null, error: { code: "PGRST116", message: "No rows found" } } }),
    );
    const res = await PATCH(makePatchContext());
    expect(res.status).toBe(404);
  });

  it("returns 200 with updated campaign on success", async () => {
    const campaign = { id: "camp-1", name: "Updated Campaign", user_id: "user-1" };
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({ campaigns: { data: campaign, error: null } }));
    const res = await PATCH(makePatchContext());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { campaign: typeof campaign };
    expect(body.campaign.id).toBe("camp-1");
  });
});

describe("DELETE /api/campaigns/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 500 when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await DELETE(makeDeleteContext());
    expect(res.status).toBe(500);
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await DELETE(makeDeleteContext(null));
    expect(res.status).toBe(401);
  });

  it("returns 500 when campaigns DELETE errors — confirms RISK fix", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({ campaigns: { data: null, error: { message: "DB error" } } }),
    );
    const res = await DELETE(makeDeleteContext());
    expect(res.status).toBe(500);
  });

  it("returns 404 when campaign is not found", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({ campaigns: { data: [], error: null } }));
    const res = await DELETE(makeDeleteContext());
    expect(res.status).toBe(404);
  });

  it("returns 200 with success:true on successful delete", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({ campaigns: { data: [{ id: "camp-1" }], error: null } }));
    const res = await DELETE(makeDeleteContext());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });
});
