import { vi } from "vitest";

export function makeAuthClientMock(
  results: {
    exchangeCodeForSession?: { error: unknown };
    resetPasswordForEmail?: { error: unknown };
    updateUser?: { error: unknown };
  } = {},
): any {
  return {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue(results.exchangeCodeForSession ?? { error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue(results.resetPasswordForEmail ?? { error: null }),
      updateUser: vi.fn().mockResolvedValue(results.updateUser ?? { error: null }),
    },
  };
}
