# Internal Security Review — Stellaroid Earn (pre-mainnet)

> **This is an internal review by the maintainer, NOT an independent third-party audit.**
> It documents the security posture before mainnet activation and satisfies the M-2
> tripwire as a maintainer decision (APAC spec §5). It does not certify the contract or the
> app. An independent audit remains roadmap before any non-demo, real-value usage at scale.
>
> Reviewed: 2026-06-13 · Scope: `frontend/` through Week 4 (offline verify, passkey wallets,
> USDC payouts, SAC-event detection, mainnet kill switch). The Soroban contract lives in a
> separate repo and is out of this review's scope except where noted.

## Trust model & invariants

- **Non-custodial, always.** The app never signs, routes, or holds funds on any network.
  Payments are wallet-to-wallet; the app only *creates signed intent links* and *reads*
  on-chain state to detect payment. Verified by inspection: no signing/submission of value
  transfers anywhere in `frontend/`.
- **The contract is the database.** No app DB. Payout intents are stateless HMAC-signed
  tokens (`payout-intent.ts`); state is re-derived from chain + token on every request.
- **Secrets are server-only** (Working Agreement rule 4). `PAYOUT_INTENT_SECRET`,
  `PASSKEY_RELAYER_*`, and `ENABLE_MAINNET_PAYMENTS` are read server-side and never
  `NEXT_PUBLIC_*`; the passkey/quote/payment-detect server modules throw if imported into a
  client bundle.

## Findings by surface

**Payout intent tokens** — HMAC-SHA256 over canonical JSON, constant-time compare
(`timingSafeEqual`); decode re-validates shape even when the signature matches. Production
requires `PAYOUT_INTENT_SECRET` (no dev fallback). Asset is versioned and an unknown asset
is rejected as forged. *Residual:* anyone with a link can view it (by design — no PII in
the token beyond a public address + hash).

**Payment detection** — classic path keys on recipient + amount + time; for USDC it
additionally requires the **configured issuer**, blocking look-alike "USDC" from a
different issuer. SAC-event path (`sac-events.ts`) only counts `inSuccessfulContractCall`
transfers to the recipient. Both are read-only.

**Mainnet kill switch** — `ENABLE_MAINNET_PAYMENTS` gates `/api/payout-intent`; testnet is
always active, mainnet is paused unless explicitly enabled. Read at request time → can pause
without redeploy. Pure rule is unit-tested.

**Passkey wallets** — WebAuthn-only credentials; the wallet contract address is validated
(`isValidContractAddress`) before it is ever trusted as a recipient. Relayer submits the
deploy (server-only); the client never sees relayer secrets. `passkey-kit` is dynamic-
imported so it cannot leak into landing/proof bundles (P1-3, verified by build sizes).

**Offline verify** — signature verification is pure client crypto (`@noble/ed25519`); the
offline result is honestly labeled "pending chain re-check" and never presented as final
(Honest-UX rule 7).

**Web hardening** — nonce-based CSP + security headers (`X-Frame-Options`, nosniff,
Referrer-Policy, HSTS) on every route; camera scoped to `/verify` only. Dynamic proof
routes validate the 64-hex hash before any RPC call. `/api/*` routes are rate-limited.
SSR does not fetch arbitrary issuer-supplied URLs (SSRF guard).

## Pre-mainnet checklist (maintainer)

- [ ] Contract `revoked`/`revoke()` deployed to mainnet (separate repo; one-way door).
- [ ] `PAYOUT_INTENT_SECRET` set to a strong random value in prod.
- [ ] Mainnet env + `ENABLE_MAINNET_PAYMENTS` per `docs/ops/mainnet-activation-runbook.md`.
- [ ] Demo wallets funded with small amounts; spend cap stated in copy.
- [ ] `/status` green on mainnet, ≥2 RPC providers configured for failover.

## Explicitly NOT claimed

Independent audit · formal verification of the contract · custody/again any value handling ·
that an offline-verified credential is chain-final · AI assessment of skill.
