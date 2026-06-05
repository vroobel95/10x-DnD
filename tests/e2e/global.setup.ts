import { test as setup } from "@playwright/test";
import { mkdirSync } from "node:fs";

export const AUTH_FILE = "tests/e2e/.auth/state.json";

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) throw new Error("E2E_EMAIL and E2E_PASSWORD must be set in .env.e2e");

  await page.goto("/auth/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");
  mkdirSync("tests/e2e/.auth", { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
