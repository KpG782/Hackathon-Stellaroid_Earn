# Mainnet Activation Runbook (G4)

> APAC spec §5, Pillar 3. Activating **real USDC payouts on Stellar mainnet** for the
> demo. Non-custodial throughout: the app never signs, routes, or holds funds on any
> network. Nothing mainnet is committed — the maintainer sets env in Vercel.

## 0. Prerequisites (do not skip)

- [ ] **Contract `revoked` flag + issuer-only `revoke()` shipped and deployed** — this is a
      **one-way door** and lives in the **separate Soroban contract repo**, not this one. A
      mainnet contract is permanent; the field must exist before the mainnet deploy or never.
      Deploy the updated contract to mainnet and record its contract ID.
- [ ] Internal security review signed off — see `docs/audit/internal-security-review.md`
      (labeled an internal review, **not** an independent audit; satisfies the M-2 tripwire
      as a maintainer decision).
- [ ] Passkey wallet-factory + relayer provisioned for mainnet if the passkey flow is in the
      demo (`docs/superpowers/plans/2026-06-13-week3-passkey-wallets.md`).

## 1. Environment (Vercel, encrypted — never committed, never NEXT_PUBLIC for secrets)

Network:
- `NEXT_PUBLIC_STELLAR_NETWORK=PUBLIC`
- `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015`
- `NEXT_PUBLIC_STELLAR_RPC_URL=<mainnet Soroban RPC>`
- `RPC_PROVIDERS=<json/csv of mainnet RPC providers>` — the P0-1 failover router reads this;
  list ≥2 providers so the pull-the-plug failover demo stays green.
- `NEXT_PUBLIC_STELLAR_EXPLORER_URL=https://stellar.expert/explorer/public`
- `NEXT_PUBLIC_SOROBAN_CONTRACT_ID=<mainnet contract ID with revoke()>`

Payouts:
- `ENABLE_MAINNET_PAYMENTS=true` — **the kill switch.** While unset/`false`, `/api/payout-intent`
  returns 503 and no payout links can be minted on mainnet (testnet is unaffected).
- `NEXT_PUBLIC_USDC_ISSUER` — optional; defaults to Circle's mainnet USDC issuer
  (`GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`).
- `PAYOUT_INTENT_SECRET=<long random>` — required in production (no dev fallback).

## 2. Funding checklist (demo wallets, mainnet)

- [ ] Employer demo wallet: small USDC balance for the payout + a USDC trustline; XLM for
      base reserve + fees.
- [ ] Graduate recipient: if a classic account, it needs the XLM base reserve; if a passkey
      smart wallet, the relayer sponsors creation (zero XLM) and USDC arrives via the SAC
      (no trustline step).
- [ ] Keep amounts small. State the spend cap in the demo copy.

## 3. Activate

1. Set the env above; redeploy.
2. Open `/status`: confirm the **Network · Pubnet** row reads "Mainnet payouts ENABLED",
   the RPC provider is a mainnet provider, and overall health is green.
3. Smoke test with a tiny real USDC payout end to end (create link → pay → page detects via
   the classic path for a G-recipient or the SAC-event path for a passkey wallet → peso
   value shows).

## 4. Pause / rollback (no redeploy needed)

- **Pause payouts instantly:** set `ENABLE_MAINNET_PAYMENTS=false` (or unset) in Vercel and
  save. `/api/payout-intent` starts returning 503 at the next request; `/status` shows
  "Mainnet payouts paused". Read-only proof/verify surfaces stay up.
- **Full rollback to testnet:** flip the network env block back to testnet values and
  redeploy. The contract on mainnet remains (immutable); only the app's target changes.
