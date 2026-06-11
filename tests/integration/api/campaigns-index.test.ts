import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { GET, POST } from "@/pages/api/campaigns/index";
import { makeSupabaseMock } from "../../helpers/supabase";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

function makeGetContext(user: { id: string } | null = { id: "user-1" }) {
  return {
    request: new Request("http://localhost/api/campaigns"),
    cookies: { set: vi.fn() },
    locals: { user },
    url: new URL("http://localhost/api/campaigns"),
    params: {},
  } as unknown as APIContext;
}

function makePostContext(user: { id: string } | null = { id: "user-1" }, bodyArg?: Record<string, unknown> | string) {
  const rawBody =
    bodyArg === undefined
      ? JSON.stringify({ name: "Test Campaign" })
      : typeof bodyArg === "string"
        ? bodyArg
        : JSON.stringify(bodyArg);
  return {
    request: new Request("http://localhost/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawBody,
    }),
    cookies: { set: vi.fn() },
    locals: { user },
    url: new URL("http://localhost/api/campaigns"),
    params: {},
  } as unknown as APIContext;
}

describe("GET /api/campaigns", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 500 when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await GET(makeGetContext());
    expect(res.status).toBe(500);
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await GET(makeGetContext(null));
    expect(res.status).toBe(401);
  });

  it("returns 500 when campaigns query errors", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({ campaigns: { data: null, error: { message: "DB error" } } }),
    );
    const res = await GET(makeGetContext());
    expect(res.status).toBe(500);
  });

  it("returns 200 with campaigns list on success", async () => {
    const campaigns = [{ id: "c-1", name: "My Campaign", user_id: "user-1" }];
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({ campaigns: { data: campaigns, error: null } }));
    const res = await GET(makeGetContext());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { campaigns: typeof campaigns };
    expect(body.campaigns).toEqual(campaigns);
  });
});

describe("POST /api/campaigns", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 500 when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await POST(makePostContext());
    expect(res.status).toBe(500);
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await POST(makePostContext(null));
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is not valid JSON", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await POST(makePostContext({ id: "user-1" }, "not-valid-json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is empty", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await POST(makePostContext({ id: "user-1" }, { name: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name exceeds 200 characters", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await POST(makePostContext({ id: "user-1" }, { name: "a".repeat(201) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when description exceeds 500 characters", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await POST(makePostContext({ id: "user-1" }, { name: "Valid Name", description: "x".repeat(501) }));
    expect(res.status).toBe(400);
  });

  it("returns 500 when campaigns insert fails", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({ campaigns: { data: null, error: { message: "insert error" } } }),
    );
    const res = await POST(makePostContext());
    expect(res.status).toBe(500);
  });

  it("returns 200 with campaign on success", async () => {
    const campaign = { id: "c-1", name: "Test Campaign", user_id: "user-1" };
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({ campaigns: { data: campaign, error: null } }));
    const res = await POST(makePostContext());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { campaign: typeof campaign };
    expect(body.campaign.id).toBe("c-1");
  });
});
