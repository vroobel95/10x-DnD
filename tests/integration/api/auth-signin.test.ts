import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { POST } from "@/pages/api/auth/signin";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

function makeContext(
  fields: Record<string, string> = { email: "test@example.com", password: "password123" },
): APIContext {
  const body = new URLSearchParams(fields).toString();
  return {
    request: new Request("http://localhost/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }),
    cookies: { set: vi.fn() },
    locals: { user: null },
    url: new URL("http://localhost/api/auth/signin"),
    params: {},
    redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
  } as unknown as APIContext;
}

function makeSigninMock(result: { error: unknown } = { error: null }): any {
  return { auth: { signInWithPassword: vi.fn().mockResolvedValue(result) } };
}

describe("POST /api/auth/signin", () => {
  beforeEach(() => vi.resetAllMocks());

  it("redirects with error when required form fields are missing", async () => {
    vi.mocked(createClient).mockReturnValue(makeSigninMock());
    const res = await POST(makeContext({ email: "test@example.com" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=");
  });

  it("redirects to error page when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await POST(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=");
  });

  it("redirects with safe error message when sign-in fails — confirms Risk #6 fix", async () => {
    vi.mocked(createClient).mockReturnValue(makeSigninMock({ error: { message: "Invalid login credentials" } }));
    const res = await POST(makeContext());
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain(encodeURIComponent("Sign in failed. Please try again."));
    expect(location).not.toContain("Invalid login credentials");
  });

  it("redirects to / on successful sign-in", async () => {
    vi.mocked(createClient).mockReturnValue(makeSigninMock());
    const res = await POST(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });
});
