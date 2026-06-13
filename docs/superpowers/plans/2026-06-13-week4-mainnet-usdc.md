# Week 4 — Mainnet Activation + USDC Payouts — Plan

> Spec: `docs/superpowers/specs/2026-06-12-apac-hackathon-phase-design.md` §5 (Pillar 3),
> timeline §9 row "Week 4". Builds on Weeks 1–3 on `feat/pwa-shell`.

**Goal:** the credential-gated payout loop pays **real USDC on mainnet**, and the demo arc
(§10) closes: passkey wallet → mainnet credential → offline verify → **USDC payout detected
live** → peso value. Non-custodial throughout; the app never holds or routes funds.

Split into a testable-now part and an infra/contract-gated part.

## Phase A — USDC payout asset  ✅ done (2026-06-13)

Pure TypeScript + UI, fully tested in CI. The payout can be denominated in XLM or USDC,
defaulting to USDC for the mainnet demo.

- `payout-asset.ts` (new): `PayoutAsset = "XLM" | "USDC"`, `isPayoutAsset`,
  `normalizePayoutAsset`, `PAYOUT_ASSETS` (USDC first = default), CoinGecko id map.
- `payout-intent.ts`: intent token versioned with `asset` — **backward compatible**: legacy
  tokens with no asset decode as XLM; a present-but-unknown asset is rejected as forged.
- `config.ts`: `getUsdcIssuer()` — Circle's canonical USDC issuer per network
  (testnet/mainnet), overridable via `NEXT_PUBLIC_USDC_ISSUER`.
- `payment-detect.ts`: asset-aware matching — native for XLM, or a `credit_alphanum*` USDC
  payment **from the configured issuer** (the issuer check blocks look-alike assets). Still
  honest about contract recipients (Phase B / SAC events below).
- `quote.ts`: `getQuote(asset, "PHP")` quotes USDC via CoinGecko `usd-coin` with a
  per-asset cache; PDAX staging stays XLM-only.
- UI: employer `payout-link-form` gains an asset selector (default USDC) and now accepts
  passkey **C-addresses** (Week 3 gap closed); `/api/quote?asset=`, `FiatValue asset=`, and
  the payout page render the chosen asset with a network-aware label (mainnet-ready).

Tests (+14): asset matrix, intent versioning incl. legacy-token + forged-asset, USDC quote
+ cache isolation, USDC detection incl. look-alike-issuer rejection. Unit 138/138; build,
e2e 17/17, PWA 3/3 green.

## Phase B — SAC transfer-event detection (closes the passkey loop)  ✅ done (2026-06-13)

A USDC payment to a passkey **smart wallet (C-address)** is a Stellar Asset Contract
`transfer`, not a classic Horizon payment, so Phase A's classic matcher (correctly) won't
see it. Now detected via Soroban RPC `getEvents`:

- `sac-events.ts` (server-only): `sacContractIdForAsset` derives the asset's SAC contract
  (`Asset.contractId(passphrase)`), `getEvents` is queried with a `transfer`-to-recipient
  topic filter (both the 3-topic and 4-topic SAC shapes), and each event is decoded via
  `scValToNative` into `{ to, amountStroops }`. `findSacTransfer` applies the same
  recipient/time/amount rules as the classic matcher. Result is normalized to the shared
  `DetectedPayment` shape.
- The payout page dispatches on recipient kind: `classifyRecipient(...) === "contract"` →
  `detectSacPayout` (SAC events); otherwise the classic Horizon path. Both render
  identically.
- Decode + match are pure and the RPC is injected, so the whole path is unit-tested
  (real `transfer` ScVals built with stellar-sdk; look-alike/underpay/old/failed-call
  rejection). The live demo still needs a real USDC transfer on the target network.

Tests (+8): decode (3- and 4-topic), reject non-transfer/failed/malformed, match rules,
SAC id per asset, stroops formatting, full `detectSacPayout` with an injected RPC. Unit
146/146; build, e2e 17/17, PWA 3/3 green.

## Phase C — Mainnet activation  ✅ in-repo work done (2026-06-13)

The app-side activation plumbing is built and tested; the remaining items are maintainer
env + the other repo's contract change.

- **`ENABLE_MAINNET_PAYMENTS` kill switch** — `config.ts` adds `isMainnet`,
  `mainnetPaymentsEnabled`, `paymentsActive` (+ the pure `arePaymentsActive` rule).
  `/api/payout-intent` returns 503 when paused. Read at request time → pause without
  redeploy. Testnet is always active. Unit-tested.
- **`/status` shows network + payments** — the health report gains `network` + a `payments`
  check (mainnet on/off, kill-switch state); `/status` renders a "Network · …" row and the
  network-aware contract card. The RPC provider was already surfaced.
- **`docs/ops/mainnet-activation-runbook.md`** — env (incl. `RPC_PROVIDERS` failover list),
  funding checklist (XLM reserves + USDC), activate/verify, and instant pause/rollback.
- **`docs/audit/internal-security-review.md`** — internal review (explicitly **not** an
  independent audit), covering the non-custodial model, secrets handling, payment-detection
  issuer checks, the kill switch, passkey/offline surfaces, and web hardening. Satisfies the
  M-2 tripwire as a maintainer decision.

**Still gated (not in this repo):** the contract **`revoked` flag + issuer-only `revoke()`**
— a one-way door in the **separate Soroban contract repo** that must be deployed to mainnet
before activation. Plus maintainer steps: set mainnet env in Vercel, fund demo wallets with
small amounts, flip `ENABLE_MAINNET_PAYMENTS=true`. See the runbook.

Tests (+4 config): kill-switch matrix, env reading, testnet-default, USDC issuer validity.
Unit 150/150; build, e2e 17/17, PWA 3/3 green.

## Gate

`npm run lint && npm run test:unit && npm run build && npm run test:e2e &&
npm run test:e2e:pwa` — all green; commit; push `feat/pwa-shell`.
