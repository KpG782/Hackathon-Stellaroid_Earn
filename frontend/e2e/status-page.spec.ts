import { expect, test } from "@playwright/test";

test("status page exposes project health, domain state, and proof links", async ({ page }) => {
  const healthResponse = await page.request.get("/api/health");
  expect(healthResponse.ok()).toBe(true);
  const health = await healthResponse.json();
  expect(health.checks.contract.detail).toContain("Contract ID configured");
  expect(health.checks.contract.detail).not.toContain("reachable");

  await page.goto("/status");

  await expect(
    page.getByRole("heading", { name: "Project Status" }),
  ).toBeVisible();
  await expect(page.getByText("Fallback demo", { exact: true })).toBeVisible();
  await expect(page.getByText("Custom domain", { exact: true })).toBeVisible();
  // Network label is dynamic; the e2e deployment targets testnet.
  await expect(page.getByText("Stellar Testnet", { exact: true })).toBeVisible();
  await expect(page.getByText(/Network · Testnet/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open sample proof" })).toHaveAttribute(
    "href",
    /^\/proof\/[0-9a-f]{64}$/,
  );
  await expect(page.getByRole("link", { name: "View contract" })).toHaveAttribute(
    "href",
    /stellar\.expert\/explorer\/testnet\/contract\//,
  );
});
