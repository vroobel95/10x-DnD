import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { POST } from "@/pages/api/auth/reset-password";
import { makeAuthClientMock } from "../../helpers/auth";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

function makeContext({
  user = { id: "user-1" },
  password = "valid-password-123",
  confirmPassword = "valid-password-123",
}: {
  user?: { id: string } | null;
  password?: string;
  confirmPassword?: string;
} = {}) {
  const body = new URLSearchParams({ password, confirm_password: confirmPassword }).toString();
  return {
    request: new Request("http://localhost/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }),
    cookies: { set: vi.fn() },
    locals: { user },
    url: new URL("http://localhost/api/auth/reset-password"),
    params: {},
    redirect: (redirectUrl: string) => new Response(null, { status: 302, headers: { Location: redirectUrl } }),
  } as unknown as APIContext;
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => vi.resetAllMocks());

  it("redirects unauthenticated user to forgot-password page", async () => {
    vi.mocked(createClient).mockReturnValue(makeAuthClientMock());
    const res = await POST(makeContext({ user: null }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/auth/forgot-password");
  });

  it("redirects to error page when password is too short", async () => {
    vi.mocked(createClient).mockReturnValue(makeAuthClientMock());
    const res = await POST(makeContext({ password: "abc", confirmPassword: "abc" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=");
  });

  it("redirects to error page when passwords do not match", async () => {
    vi.mocked(createClient).mockReturnValue(makeAuthClientMock());
    const res = await POST(makeContext({ password: "valid-password-1", confirmPassword: "valid-password-2" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=");
  });

  it("redirects to error page (not success) when supabase client is null", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const res = await POST(makeContext());
    const location = res.headers.get("location") ?? "";
    expect(res.status).toBe(302);
    expect(location).toContain("error=");
    expect(location).not.toContain("success");
  });

  it("redirects to error page when password update fails", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeAuthClientMock({ updateUser: { error: { message: "Update failed" } } }),
    );
    const res = await POST(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=");
  });

  it("redirects to signin success page after password is updated", async () => {
    vi.mocked(createClient).mockReturnValue(makeAuthClientMock());
    const res = await POST(makeContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/auth/signin?success=1");
  });
});
