import { expect, test } from "@playwright/test";

// next.config.ts splits Permissions-Policy into two rules: camera is denied
// globally but allowed (same-origin) on /verify for QR scanning. These tests
// run against `next dev` (see playwright.config.ts), where headers() rules
// apply — and they apply to a matching path even before the route exists, so
// the header assertions below stay status-agnostic.

test("global routes deny camera via Permissions-Policy", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);

  const policy = response.headers()["permissions-policy"];
  expect(policy).toContain("camera=()");
  expect(policy).toContain("microphone=()");
  expect(policy).toContain("geolocation=()");
});

test("/verify allows same-origin camera via Permissions-Policy", async ({ request }) => {
  // Status intentionally not asserted here: the /verify page is built by a
  // parallel workstream and may not exist yet. headers() rules match on the
  // request path, so the Permissions-Policy override is observable either way.
  const response = await request.get("/verify");

  const policy = response.headers()["permissions-policy"];
  expect(policy).toContain("camera=(self)");
  expect(policy).not.toContain("camera=()");
  expect(policy).toContain("microphone=()");
  expect(policy).toContain("geolocation=()");
});

test("/verify keeps all other global security headers", async ({ request }) => {
  const response = await request.get("/verify");
  const headers = response.headers();

  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["strict-transport-security"]).toBe(
    "max-age=63072000; includeSubDomains; preload",
  );
});

// The /verify page landed during integration; this now asserts it resolves.
test("/verify page resolves with 200", async ({ request }) => {
  const response = await request.get("/verify");
  expect(response.status()).toBe(200);
});
