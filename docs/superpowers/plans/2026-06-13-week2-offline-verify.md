# Week 2 — Issuer Signatures + Offline QR Verify Loop — Implementation Plan

> **For agentic workers:** Executed via parallel subagents (superpowers:dispatching-parallel-agents). Three disjoint workstreams coded against the contracts below; integration, full gates, and commits happen centrally afterward.

**Goal:** Spec §3 Pillar 1, Week 2: credentials gain an offline-verifiable issuer signature; a graduate can show a self-contained QR; an employer's installed PWA verifies it fully offline (signature vs cached issuer registry) and upgrades to on-chain verification when connectivity returns.

**Architecture:** Signature is ed25519 over canonical (stable-stringified) credential JSON using the SEP-43 message construction ("Stellar Signed Message:\n" prefix + SHA-256), so the issuer's existing Stellar key is the trust root and `issuer-registry.ts` doubles as the offline registry. The QR payload is `SLR1:` + base45(deflate-raw(JSON{v,credential,sig,issuer})) — the EU health-pass pattern. Verification is pure client crypto via `@noble/ed25519` (~4KB) — **no stellar-sdk in client bundles** (P1-3 invariant). Demo credentials are signed by a script with a CLI-held key; live Freighter `signMessage` issuer signing is a Week-2.5 follow-up.

**Tech stack:** `@noble/ed25519` 3.x, `jsqr` 1.4 (dynamic import on the scanner route only), native `CompressionStream`/`DecompressionStream`, hand-rolled RFC 9285 base45 + strkey decode (with stellar-sdk cross-validation in tests only).

---

## Workstream ownership (disjoint file sets)

| Agent | Domain | Files |
|---|---|---|
| **A** | Crypto/codec lib + signing script + credential.json embedding | Create: `src/lib/strkey-lite.ts(+.test)`, `src/lib/credential-sign.ts(+.test)`, `src/lib/offline-payload.ts(+.test)`, `scripts/sign-credential.ts`. Modify: `src/lib/open-badge.ts(+.test)`, `src/lib/proof-metadata.ts` (additive optional field), `src/app/proof/[hash]/credential.json/route.ts` |
| **B** | Verify UI + offline QR surfaces | Create: `src/app/verify/page.tsx`, `src/components/verify/scanner.tsx`, `src/components/verify/verify-result.tsx`, `src/components/proof/offline-qr-block.tsx`, `src/app/proof/[hash]/offline-qr/route.ts`, `e2e/verify-offline.spec.ts`. Modify: proof page to mount the QR block |
| **C** | Headers + SW plumbing | Modify: `next.config.ts` (camera Permissions-Policy scoped to `/verify`; precache `/verify`), `src/app/sw.ts` (if needed). Create: `e2e/headers.spec.ts` |

Coordination rules: deps pre-installed centrally (`@noble/ed25519`, `jsqr`); agents do NOT run `npm install`, do NOT run `next build`, do NOT commit, and stay strictly inside their file lists. B codes against A's contracts (modules may not exist while B works).

## API contracts (agents code against these exactly)

```ts
// src/lib/strkey-lite.ts — zero-dep G-address decoder (client-safe)
export function ed25519PublicKeyFromAddress(gAddress: string): Uint8Array; // throws Error on bad version/checksum (CRC16-XModem)

// src/lib/credential-sign.ts
export function canonicalCredentialBytes(credential: Record<string, unknown>): Uint8Array; // recursive key-sorted JSON.stringify → UTF-8
export function sep43Digest(message: Uint8Array): Promise<Uint8Array>; // SHA-256("Stellar Signed Message:\n" + message) — single function; TODO(verify-freighter) doc
export function verifyCredentialSignature(opts: {
  credential: Record<string, unknown>;
  signatureBase64: string;
  issuerAddress: string;
}): Promise<boolean>; // never throws on bad input — returns false

// src/lib/offline-payload.ts
export interface OfflineCredentialPayload {
  v: 1;
  credential: Record<string, unknown>;
  sig: string;     // base64
  issuer: string;  // G-address
}
export async function encodeOfflinePayload(p: OfflineCredentialPayload): Promise<string>;  // "SLR1:" + base45(deflateRaw(JSON))
export async function decodeOfflinePayload(s: string): Promise<OfflineCredentialPayload>; // throws Error with stable .message codes: "bad-prefix" | "bad-base45" | "bad-deflate" | "bad-shape"

// src/lib/open-badge.ts (addition)
export function buildSignableCredential(hash: string, meta: ProofMetadata): Record<string, unknown>; // the ONE object that gets signed, embedded in credential.json, and carried in the QR

// src/lib/proof-metadata.ts (additive optional field on the metadata type)
issuerSignature?: { alg: "sep43-ed25519"; sig: string; issuer: string; signedAt: string };
```

Size budget: encoded payload for a realistic demo credential ≤ 1800 chars (unit-tested).

## Design brief for B (from ui-ux-pro-max + existing tokens)

Existing system: dark slate bg, gold primary `#F59E0B` (trust), purple accent, Orbitron headings/Exo 2 body, lucide-react icons, tokens in `src/styles/globals.css`, ui primitives in `src/components/ui`.

- `/verify`: mobile-first, full-bleed dark camera viewport, gold corner-bracket scan frame (CSS only, no layout shift), torch toggle where `MediaTrackCapabilities.torch` exists (low-light job fairs), "Scanning…" pulse line (respect `prefers-reduced-motion`), ≥44px touch targets. **Fallbacks (also the e2e path):** paste payload text + upload QR image; "enter hash manually" link → `/proof`.
- Result states — never color-only (icon + label + color), 150–300ms color/opacity transitions:
  1. **Verified offline** — gold; `ShieldAlert`/clock motif; "Verified offline — pending chain re-check"; subtext "Signature valid · issuer registry snapshot {relative time}"; auto re-verify on reconnect (`navigator.onLine` + `online` event) upgrades to state 2.
  2. **Verified on-chain** — green; `ShieldCheck`; link to proof page/tx evidence.
  3. **Failed** — red; `ShieldX`; specific reason (bad signature / unknown issuer / malformed QR) + recovery actions ("Rescan", "Enter hash manually").
- Graduate `offline-qr-block` on the proof page: white card (QR contrast), payload QR from `/proof/[hash]/offline-qr`, "Works without internet" copy + brightness hint; rendered only when the credential has `issuerSignature`.
- Security indicators stay visible (network badge is global; registry snapshot age on the result card).

## Integration checklist (central, after agents return)

- [ ] Review each agent summary; check cross-workstream type/import consistency
- [ ] `npm run lint && npm run test:unit && npm run build && npm run test:e2e && npm run test:e2e:pwa` all green
- [ ] Sign demo credential metadata via `scripts/sign-credential.ts` (CLI key) so `/verify` is demoable
- [ ] Commit per workstream; push `feat/pwa-shell`
- [ ] Follow-ups recorded: Freighter `signMessage` in the live issuer flow (Week 2.5); validate SEP-43 construction against real Freighter output; Web NFC flourish (Week 5)
