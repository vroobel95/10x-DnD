// Risk #4 — confirmed enemies silently not written
// "After a PATCH confirm succeeds (HTTP 200), the enemy is readable in a subsequent page load."
//
// Requires: ANTHROPIC_API_KEY set in the dev server environment (generate is real AI).
// Anti-pattern avoided: DB is NOT mocked — the whole risk is whether the write persists.
//
// Auth: global.setup.ts logs in once and saves cookies to .auth/state.json.
//       playwright.config.ts injects storageState into every browser context —
//       no test or beforeAll calls a sign-in helper.

import { expect, test } from "@playwright/test";

const RUN_ID = Date.now();
const AUTH_STATE = "tests/e2e/.auth/state.json";

test.describe("confirmed enemy persists after page reload [Risk #4]", () => {
  let campaignId: string;
  let battleId: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH_STATE });
    const page = await ctx.newPage();

    // Campaign creation must go through the browser: the /api/campaigns POST reads
    // formData and responds with context.redirect(), which Playwright's APIRequestContext
    // neither encodes (it sends JSON) nor follows. Use the dedicated /campaigns/new form.
    await page.goto("/campaigns/new");
    await page.waitForLoadState("networkidle"); // React hydration — CreateCampaignForm uses client:load
    await page.getByLabel("Campaign Name").fill(`E2E Campaign ${RUN_ID}`);
    await Promise.all([
      page.waitForURL((url) => /^\/campaigns\/[0-9a-f-]{36}$/i.test(new URL(url).pathname)),
      page.getByRole("button", { name: "Create Campaign" }).click(),
    ]);
    campaignId = new URL(page.url()).pathname.split("/").at(-1) ?? "";

    // Battle creation must go through the browser: Astro's context.redirect() from a
    // form POST is not followed by Playwright's APIRequestContext in this stack.
    await page.goto(`/battles/new?campaignId=${campaignId}`);
    await page.waitForLoadState("networkidle"); // React hydration — CreateBattleForm uses client:load
    await page.getByLabel("Battle Name").fill(`E2E Battle ${RUN_ID}`);
    await Promise.all([
      page.waitForURL((url) => /^\/battles\/[0-9a-f-]{36}$/i.test(new URL(url).pathname)),
      page.getByRole("button", { name: "Create Battle" }).click(),
    ]);
    battleId = new URL(page.url()).pathname.split("/").at(-1) ?? "";

    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH_STATE });
    // Campaign delete cascades to its battles and enemies.
    await ctx.request.delete(`/api/campaigns/${campaignId}`);
    await ctx.close();
  });

  test("confirmed enemy status survives a page reload", async ({ page }) => {
    test.setTimeout(90_000); // AI generation can take up to 60 s

    await page.goto(`/battles/${battleId}`);
    await page.waitForLoadState("networkidle"); // React hydration — Generate button is disabled in SSR

    // getByRole("textbox") is unambiguous on this page: the only <textarea> is the
    // enemy-prompt field in EnemiesSection (EnemyCard edit inputs appear only when editing).
    await page.getByRole("textbox").fill("1 goblin");

    // exact: true so this matches the enemies "Generate" button, not "Generate Environment".
    const generateBtn = page.getByRole("button", { name: "Generate", exact: true });
    await expect(generateBtn).toBeEnabled(); // state signal — button is disabled until prompt is non-empty

    // Exclude r.ok() from the predicate so a non-200 surfaces rather than timing out.
    const [generateRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/generate")),
      generateBtn.click(),
    ]);
    expect(generateRes.status()).toBe(200);

    await expect(page.getByRole("heading", { name: "Pending Review" })).toBeVisible();
    const confirmBtn = page.getByRole("button", { name: "Confirm" }).first();
    await expect(confirmBtn).toBeVisible();

    const [confirmRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/enemies/")),
      confirmBtn.click(),
    ]);
    expect(confirmRes.status()).toBe(200);

    await expect(page.getByRole("heading", { name: "Confirmed Enemies" })).toBeVisible();

    // Risk #4 guard: reload discards all React state and forces a fresh SSR DB query.
    // If the PATCH wrote nothing, the heading will not reappear.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Confirmed Enemies" })).toBeVisible();
  });
});
