import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { GET } from "@/pages/api/auth/recovery-callback";
import { makeAuthClientMock } from "../../helpers/auth";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

function makeContext(options: { code?: string | null } = {}) {
  const code = "code" in options ? options.code : "valid-code";
  const url = new URL("http://localhost/api/auth/recovery-callback");
  if (code !== null && code !== undefined) url.searchParams.set("code", code);
  return {
    request: new Request(url.toString()),
    cookies: { set: vi.fn() },
    locals: { user: null },
    url,
    params: {},
    redirect: (redirectUrl: string) => new Response(null, { status: 302, headers: { Location: redirectUrl } }),
  } as unknown as APIContext;
}

describe("GET /api/auth/recovery-callback", () => {
  beforeEach(() => vi.resetAllMocks());

  it("redirects to error page when no code is provided", async () => {
    vi.mocked(createClient).mockReturnValue(makeAuthClientMock());
    const res = await GET(makeContext({ code: null }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=");
  });

  it("redirects to error page when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await GET(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=");
  });

  it("redirects to error page when code exchange fails", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeAuthClientMock({ exchangeCodeForSession: { error: { message: "Expired link" } } }),
    );
    const res = await GET(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=");
  });

  it("redirects to reset-password page after successful exchange", async () => {
    vi.mocked(createClient).mockReturnValue(makeAuthClientMock());
    const res = await GET(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/auth/reset-password");
  });
});
