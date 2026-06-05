// Seed test — canonical E2E template for this project.
// Shows the four patterns every generated test must follow.
// Keep this file simple: one test, inline setup, inline cleanup, no beforeAll.

import { expect, test } from "@playwright/test";

// [1] UNIQUE ID — prevents collisions in parallel runs and after cleanup failures
const name = `Seed Campaign ${Date.now()}`;

test("created campaign appears in list after navigation [Risk #3 smoke]", async ({ page }) => {
  // Setup: create a campaign through the UI
  await page.goto("/campaigns");
  await page.waitForLoadState("networkidle"); // React hydration — CreateCampaignForm uses client:load

  await page.getByRole("button", { name: "+ Create Campaign" }).click(); // [2] ROLE-BASED LOCATORS
  await page.getByLabel("Name").fill(name); // getByLabel when a visible label exists
  await page.getByRole("button", { name: "Create Campaign" }).click();

  // [3] WAIT FOR STATE — waitForURL instead of waitForTimeout
  await page.waitForURL((url) => /\/campaigns\/[0-9a-f-]{36}$/.test(new URL(url).pathname));
  const id = new URL(page.url()).pathname.split("/").at(-1) ?? "";

  // Action: navigate away and back — exercises the server-side DB read, not just React state
  await page.goto("/campaigns");

  // [4] RISK-TIED ASSERTION — if the POST silently wrote nothing (Risk #3), this fails
  await expect(page.getByText(name)).toBeVisible(); // toBeVisible() retries until visible

  // Cleanup: delete via the API (page.request shares the storageState auth cookies)
  await page.request.delete(`/api/campaigns/${id}`);
});
