# Week 3 — Passkey Graduate Wallets + Payout Recipient Integration — Plan

> Spec: `docs/superpowers/specs/2026-06-12-apac-hackathon-phase-design.md` §4 (Pillar 2),
> timeline §9 row "Week 3". Builds on Week 1 (PWA shell) and Week 2 (offline verify),
> both shipped on `feat/pwa-shell`.

**Goal:** graduates get a payout wallet with a fingerprint — no seed phrase, no
extension, no XLM — and that wallet's address flows through the existing payout loop.
Employers/issuers keep the shipped Freighter flow unchanged.

This phase splits cleanly into a part that is **fully buildable + testable in CI now**
and a part that is **gated on external dependencies** (a Launchtube token, a deployed
WebAuthn wallet-factory, and a real device). They are sequenced so the gated part is
turn-key when the gates clear.

---

## Phase A — Payout recipient integration  ✅ done (2026-06-13)

Pure TypeScript, no new deps, fully unit-tested. Teaches the payout loop that a
recipient can be a Soroban smart-wallet **contract (C-address)**, not only a classic
**account (G-address)** — the seam a passkey wallet plugs into.

- `src/lib/strkey-lite.ts`: added non-throwing `isValidEd25519PublicKey` and
  `isValidContractAddress` (contract version byte `2<<3 = 16`), sharing the existing
  base32 + CRC16-XModem decode. Existing throwing `ed25519PublicKeyFromAddress` (verify
  path) untouched.
- `src/lib/recipient-address.ts` (new): `classifyRecipient → "ed25519" | "contract" |
  null` and `isValidRecipientAddress`. Single source of truth for payable address shapes.
- `src/lib/payout-intent.ts`: recipient validation now accepts G **or** C (checksum-
  validated) instead of the G-only regex. Backward compatible — every existing token and
  G-recipient still validates byte-for-byte.
- `src/lib/payment-detect.ts`: classic Horizon matcher now explicitly returns no match
  for contract recipients (a SAC transfer to a contract is not a classic payment), and
  `fetchRecentPayments` short-circuits contracts (no pointless `/accounts/{C}` 404 per
  poll tick). A contract recipient therefore degrades to "credential_verified / awaiting
  payment" — honest, not a false negative. **Detecting payments to a contract is Phase C
  / Week 4 (SAC transfer events via Soroban RPC `getEvents`).**

Tests added (10): strkey validators incl. SDK cross-validation; `classifyRecipient`
matrix; C-recipient intent round-trip + corrupted-checksum rejection; contract-recipient
detection behavior. Unit suite 112/112.

## Phase B — Passkey smart-wallet creation (graduate-only)  🔒 gated

**External gates (must clear before this is buildable-and-verifiable):**
1. **Launchtube testnet token** — fee-sponsored submission so the graduate needs zero
   XLM (`docs/ops/launchtube-request.md`, currently unchecked). Mainnet credits are the
   Week-4 concern; testnet instance is open.
2. **Deployed WebAuthn wallet-factory** — the secp256r1 smart-wallet contract
   `passkey-kit` deploys against (testnet).
3. **A real device** for WebAuthn — headless CI cannot exercise Face ID / fingerprint;
   the spec's test strategy is "mock WebAuthn in unit tests; real device in e2e manual
   checklist."

**Library reality (verified on npm, not assumed):** `passkey-kit@0.12.0` depends on
`@stellar/stellar-sdk@^14` (this repo is on `^13` — they install nested, no forced app
bump, but it is a second SDK copy), `@simplewebauthn/browser@^13`, `passkey-kit-sdk`,
`sac-sdk`, `@openzeppelin/relayer-plugin-channels`. Implication: `passkey-kit` MUST be
**dynamic-imported on the graduate wallet route only** and verified by the bundle
analyzer to keep landing/proof routes at zero wallet bytes (P1-3 invariant). Server
pieces (`PasskeyServer`, Launchtube JWT) stay server-only (Working Agreement rule 4).

**Build steps when gates clear:**
- `src/lib/config.ts`: server-only `LAUNCHTUBE_URL`, `LAUNCHTUBE_JWT`, `PASSKEY_*` reads;
  never `NEXT_PUBLIC_*`. A `passkeysEnabled` flag (default off → Freighter fallback).
- `src/lib/passkey/` (client, dynamic-imported): wrap `PasskeyKit` — create wallet
  (Face ID), connect existing, expose the wallet **contract address** as the payout
  recipient. `src/lib/passkey/server.ts` (server-only): `PasskeyServer` + Launchtube send.
- Graduate UI: a wallet-kind seam so the `/app` payout-recipient comes from Freighter (G)
  *or* a passkey wallet (C). Employers/issuers keep `WalletConnectButton` (Freighter).
- **Fallback (spec §11):** if a gate is unmet by Week 4, passkeys demo on testnet and the
  mainnet payout recipient is a Freighter classic address, clearly badged. Phase A already
  makes the recipient model accept whichever address the graduate ends up with.

**Tests:** wallet-creation flow (mock WebAuthn unit; real device manual e2e checklist);
recipient-address derivation (covered by Phase A's classifier); bundle-isolation check
(analyzer asserts zero wallet bytes on landing/proof).

## Phase C — Payment detection for contract recipients  → Week 4

SAC transfer-event detection (Soroban RPC `getEvents` on the asset contract, filtered by
`to` = wallet address) so payments to a smart wallet are detected live. Tracked with the
Week-4 USDC payout-ops work (spec §5). Phase A's `payment-detect` guards are the seam.

## Gate (this phase, Phase A)

`npm run lint && npm run test:unit && npm run build && npm run test:e2e &&
npm run test:e2e:pwa` — all green; commit; push `feat/pwa-shell`.
