// Offline-verify loop (/verify) — exercises the non-camera fallback path,
// which is the e2e-testable path: headless Chromium has no camera, so the
// scanner shows its no-camera state while the paste/upload fallbacks stay
// fully functional. The SEP-43 construction is replicated in-spec (rather
// than imported from src/lib/credential-sign) so it cross-validates the lib.

import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import * as ed from "@noble/ed25519";
import { StrKey } from "@stellar/stellar-sdk";
import { encodeOfflinePayload } from "../src/lib/offline-payload";

const FIXTURE_HASH = createHash("sha256")
  .update("stellaroid-verify-offline-e2e-fixture")
  .digest("hex");

// Credential mirroring buildSignableCredential's shape: identifier and
// achievement live at the top level (no cert/baseUrl-dependent fields).
const FIXTURE_CREDENTIAL: Record<string, unknown> = {
  "https://stellaroid.tech/ns#signableVersion": 1,
  type: ["StellaroidSignableCredential", "AchievementSubject"],
  identifier: [
    {
      type: "IdentityObject",
      identityHash: FIXTURE_HASH,
      identityType: "identifier",
      hashed: true,
      salt: "not-salted",
    },
  ],
  achievement: {
    type: ["Achievement"],
    name: "Offline Verify E2E Fixture",
    description: "Synthetic credential signed by a throwaway key.",
    tag: [],
  },
};

// Replicate the SEP-43 construction independently of src/lib/credential-sign
// so this spec cross-validates the lib: SHA-256 over
// UTF8("Stellar Signed Message:\n") + canonical key-sorted JSON bytes.
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function sep43Digest(credential: Record<string, unknown>): Uint8Array {
  const message = Buffer.from(JSON.stringify(canonicalize(credential)), "utf8");
  const digest = createHash("sha256")
    .update(Buffer.from("Stellar Signed Message:\n", "utf8"))
    .update(message)
    .digest();
  return new Uint8Array(digest);
}

test("verify page renders the scanner UI with all three fallbacks", async ({
  page,
}) => {
  await page.goto("/verify");

  await expect(
    page.getByRole("heading", { name: "Verify a credential" }),
  ).toBeVisible();
  await expect(page.getByTestId("verify-viewport")).toBeVisible();

  // Fallback 1: paste an SLR1: payload.
  await expect(page.getByLabel("Paste code")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Verify pasted code" }),
  ).toBeVisible();
  // Fallback 2: upload a QR image (hidden file input + visible trigger). The
  // input and the button carry distinct accessible names on purpose — a file
  // input is exposed with role=button, so a shared name would be ambiguous to
  // assistive tech (and to this strict-mode query).
  await expect(
    page.getByRole("button", { name: "Upload QR image" }),
  ).toBeVisible();
  await expect(page.getByLabel("QR image file")).toBeAttached();
  // Fallback 3: manual hash entry.
  await expect(
    page.getByRole("link", { name: /Enter hash manually/ }),
  ).toHaveAttribute("href", "/proof");
});

test("pasting garbage shows the malformed-QR failure with recovery actions", async ({
  page,
}) => {
  await page.goto("/verify");

  await page.getByLabel("Paste code").fill("definitely-not-a-credential");
  await page.getByRole("button", { name: "Verify pasted code" }).click();

  await expect(page.getByText("Malformed QR code")).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan again" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Enter hash manually/ }),
  ).toBeVisible();

  // "Scan again" recovers back to the scanner view.
  await page.getByRole("button", { name: "Scan again" }).click();
  await expect(page.getByLabel("Paste code")).toBeVisible();
});

test("a validly signed payload from an unregistered issuer fails with a registry error", async ({
  page,
}) => {
  // Fresh ed25519 key — its G-address cannot be in the bundled registry.
  const secretKey = ed.utils.randomSecretKey();
  const publicKey = await ed.getPublicKeyAsync(secretKey);
  const issuer = StrKey.encodeEd25519PublicKey(Buffer.from(publicKey));

  const signature = await ed.signAsync(
    sep43Digest(FIXTURE_CREDENTIAL),
    secretKey,
  );
  const payload = await encodeOfflinePayload({
    v: 1,
    credential: FIXTURE_CREDENTIAL,
    sig: Buffer.from(signature).toString("base64"),
    issuer,
  });
  expect(payload.startsWith("SLR1:")).toBe(true);

  await page.goto("/verify");
  await page.getByLabel("Paste code").fill(payload);
  await page.getByRole("button", { name: "Verify pasted code" }).click();

  await expect(page.getByText("Issuer not in registry")).toBeVisible();
  await expect(
    page.getByText(/not in the bundled issuer registry/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan again" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Enter hash manually/ }),
  ).toBeVisible();
});
