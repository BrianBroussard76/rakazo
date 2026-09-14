import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, openUserSettings, signup } from "./helpers";

test("AI disclosure blocks sending until allowed and supports withdrawal", async ({
  page,
}, testInfo) => {
  await signup(page, `consent-${Date.now()}@rakazo.test`, "password12", "Consent test");
  await completeOnboarding(page);
  let allowed = false;
  let sends = 0;
  const status = () => ({
    scope: "test-space",
    version: "2026-09-14",
    recipients: [
      {
        key: "test-recipient",
        name: "Example AI",
        use: "model",
        detail: "Model: example-model",
        privacyUrl: "https://example.com/privacy",
        allowed,
      },
    ],
  });
  await page.route("**/rpc/aiConsent/**", async (route) => {
    if (route.request().url().endsWith("/allow")) {
      expect(route.request().postDataJSON().json).toEqual({
        scope: "test-space",
        version: "2026-09-14",
        keys: ["test-recipient"],
      });
      allowed = true;
    }
    if (route.request().url().endsWith("/revoke")) allowed = false;
    await route.fulfill({ json: { json: status() } });
  });
  page.on("request", (request) => {
    if (request.url().endsWith("/rpc/threads/send")) sends++;
  });
  const composer = page.getByTestId("composer-bar").locator("textarea");
  await composer.fill("Say hello");
  await composer.press("Enter");
  const disclosure = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "Share data with Example AI?" }) });
  await expect(disclosure).toBeVisible();
  await expect(disclosure.getByText(/Messages, relevant conversation history/)).toBeVisible();
  expect(sends).toBe(0);
  await captureScreenshot(page, testInfo, "ai-data-consent");
  await disclosure.getByRole("button", { name: "Not now", exact: true }).click();
  await expect(disclosure).toHaveCount(0);
  expect(sends).toBe(0);
  await expect(composer).toHaveValue("Say hello");
  await composer.press("Enter");
  await expect(disclosure).toBeVisible();
  await disclosure.getByRole("button", { name: "Allow", exact: true }).click();
  await expect.poll(() => sends).toBe(1);
  const settings = await openUserSettings(page);
  await settings.getByRole("button", { name: "Withdraw permission" }).click();
  await expect(settings.getByRole("button", { name: "Allow", exact: true })).toBeVisible();
  expect(allowed).toBe(false);
  await captureScreenshot(page, testInfo, "ai-data-sharing-settings");
});
