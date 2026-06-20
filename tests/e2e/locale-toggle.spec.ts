// Phase 1 (i18n-polish / S-16) proof test.
// Verifies the navbar language toggle switches the UI EN -> PL and that the
// choice persists across a full page reload (cookie strategy).

import { expect, test } from "@playwright/test";

test("language toggle switches UI to Polish and persists across reload", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle"); // LocaleSwitcher uses client:load

  // Starts in English (base locale)
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  // Action: switch to Polish via the navbar toggle (setLocale reloads the page)
  await page.getByRole("button", { name: "PL", exact: true }).click();

  // Wait for state: the Polish sign-out label proves the locale switched
  await expect(page.getByRole("button", { name: "Wyloguj się" })).toBeVisible();

  // Persistence: a full reload keeps Polish active via the cookie
  await page.reload();
  await expect(page.getByRole("button", { name: "Wyloguj się" })).toBeVisible();

  // Cleanup: restore English so the run leaves no sticky locale behind
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});
