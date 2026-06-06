import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { POST } from "@/pages/api/auth/forgot-password";
import { makeAuthClientMock } from "../../helpers/auth";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

function makeContext({ email = "test@example.com" }: { email?: string } = {}) {
  const body = new URLSearchParams({ email }).toString();
  return {
    request: new Request("http://localhost/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }),
    cookies: { set: vi.fn() },
    locals: { user: null },
    url: new URL("http://localhost/api/auth/forgot-password"),
    params: {},
    redirect: (redirectUrl: string) => new Response(null, { status: 302, headers: { Location: redirectUrl } }),
  } as unknown as APIContext;
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => vi.resetAllMocks());

  it("redirects to error page (not success) when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await POST(makeContext());
    const location = res.headers.get("location") ?? "";
    expect(res.status).toBe(302);
    expect(location).toContain("error=");
    expect(location).not.toContain("success");
  });

  it("redirects to error page with rate-limit message when Supabase returns 429", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeAuthClientMock({ resetPasswordForEmail: { error: { status: 429, message: "Too many requests" } } }),
    );
    const res = await POST(makeContext());
    const location = res.headers.get("location") ?? "";
    expect(res.status).toBe(302);
    expect(location).toContain("error=");
    expect(decodeURIComponent(location)).toContain("Please wait");
  });

  it("redirects to error page when Supabase returns a server error (>= 500)", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeAuthClientMock({ resetPasswordForEmail: { error: { status: 503, message: "Service unavailable" } } }),
    );
    const res = await POST(makeContext());
    const location = res.headers.get("location") ?? "";
    expect(res.status).toBe(302);
    expect(location).toContain("error=");
    expect(decodeURIComponent(location)).toContain("Something went wrong");
  });

  it("redirects to success page when reset email is sent", async () => {
    vi.mocked(createClient).mockReturnValue(makeAuthClientMock());
    const res = await POST(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/auth/forgot-password?success=1");
  });

  it("redirects to success page even for non-429/non-500 errors — prevents email enumeration", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeAuthClientMock({ resetPasswordForEmail: { error: { status: 400, message: "Invalid email" } } }),
    );
    const res = await POST(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/auth/forgot-password?success=1");
  });
});
