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
    redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
  } as unknown as APIContext;
}

function makePostContext(user: { id: string } | null = { id: "user-1" }, fields?: Record<string, string>) {
  const form = new URLSearchParams(fields ?? { name: "Test Campaign" });
  return {
    request: new Request("http://localhost/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    }),
    cookies: { set: vi.fn() },
    locals: { user },
    url: new URL("http://localhost/api/campaigns"),
    params: {},
    redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
  } as unknown as APIContext;
}

describe("GET /api/campaigns", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 500 when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await GET(makeGetContext());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Supabase is not configured");
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await GET(makeGetContext(null));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 500 when campaigns query errors", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({ campaigns: { data: null, error: { message: "DB error" } } }),
    );
    const res = await GET(makeGetContext());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Could not load campaigns");
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

  it("redirects with error when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await POST(makePostContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(
      `/campaigns/new?error=${encodeURIComponent("Supabase is not configured")}`,
    );
  });

  it("redirects to sign-in when user is not authenticated", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await POST(makePostContext(null));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/auth/signin");
  });

  it("redirects with error when name is empty", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await POST(makePostContext({ id: "user-1" }, { name: "" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`/campaigns/new?error=${encodeURIComponent("Campaign name is required")}`);
  });

  it("redirects with error when name is whitespace only", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await POST(makePostContext({ id: "user-1" }, { name: "   " }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`/campaigns/new?error=${encodeURIComponent("Campaign name is required")}`);
  });

  it("redirects with error when name is missing from body", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await POST(makePostContext({ id: "user-1" }, {}));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`/campaigns/new?error=${encodeURIComponent("Campaign name is required")}`);
  });

  it("redirects with error when name exceeds 200 characters", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await POST(makePostContext({ id: "user-1" }, { name: "a".repeat(201) }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(
      `/campaigns/new?error=${encodeURIComponent("Campaign name must be 200 characters or fewer")}`,
    );
  });

  it("redirects with error when description exceeds 500 characters", async () => {
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({}));
    const res = await POST(makePostContext({ id: "user-1" }, { name: "Valid Name", description: "x".repeat(501) }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(
      `/campaigns/new?error=${encodeURIComponent("Description must be 500 characters or fewer")}`,
    );
  });

  it("redirects with error when campaigns insert fails", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseMock({ campaigns: { data: null, error: { message: "insert error" } } }),
    );
    const res = await POST(makePostContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(
      `/campaigns/new?error=${encodeURIComponent("Could not create campaign. Please try again.")}`,
    );
  });

  it("redirects to campaign page on success", async () => {
    const campaign = { id: "c-1", name: "Test Campaign", user_id: "user-1" };
    vi.mocked(createClient).mockReturnValue(makeSupabaseMock({ campaigns: { data: campaign, error: null } }));
    const res = await POST(makePostContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/campaigns/c-1");
  });
});
