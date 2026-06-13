import { expect, test } from "@playwright/test";

test.describe("PWA shell", () => {
  test("serves a valid web app manifest", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.name).toBe("Stellaroid Earn");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  test("registers the service worker", async ({ page }) => {
    await page.goto("/");
    const swUrl = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.active?.scriptURL ?? null;
    });
    expect(swUrl).toContain("/sw.js");
  });

  test("falls back to the offline page for uncached navigations", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      return true;
    });
    // Reload so the page is controlled by the active SW before going offline.
    await page.reload();
    // Gate on the SW actually controlling the page. clientsClaim only fires
    // after activation, which the larger precache set (now including /verify)
    // can push past the reload — without this wait the offline navigation
    // races SW control and the fallback intermittently doesn't fire.
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await context.setOffline(true);
    await page.goto("/metrics");
    await expect(
      page.getByRole("heading", { name: /offline/i }),
    ).toBeVisible();
    await context.setOffline(false);
  });
});
