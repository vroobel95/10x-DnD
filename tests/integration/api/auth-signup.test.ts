import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { POST } from "@/pages/api/auth/signup";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

function makeContext(): APIContext {
  const body = new URLSearchParams({ email: "test@example.com", password: "password123" }).toString();
  return {
    request: new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }),
    cookies: { set: vi.fn() },
    locals: { user: null },
    url: new URL("http://localhost/api/auth/signup"),
    params: {},
    redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
  } as unknown as APIContext;
}

function makeSignupMock(result: { error: unknown } = { error: null }): any {
  return { auth: { signUp: vi.fn().mockResolvedValue(result) } };
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => vi.resetAllMocks());

  it("redirects to error page when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await POST(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=");
  });

  it("redirects with safe error message when sign-up fails — confirms Risk #6 fix", async () => {
    vi.mocked(createClient).mockReturnValue(makeSignupMock({ error: { message: "User already registered" } }));
    const res = await POST(makeContext());
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain(encodeURIComponent("Could not create account. Please try again."));
    expect(location).not.toContain("User already registered");
  });

  it("redirects to /auth/confirm-email on successful sign-up", async () => {
    vi.mocked(createClient).mockReturnValue(makeSignupMock());
    const res = await POST(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/auth/confirm-email");
  });
});
