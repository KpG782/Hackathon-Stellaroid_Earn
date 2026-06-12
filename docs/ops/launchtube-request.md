# Launchtube Access — Week 1 External Dependency

**What:** Launchtube (github.com/stellar/launchtube) submits Soroban transactions and
covers fees/sequence handling, so passkey smart-wallet users need zero XLM. Required for
Pillar 2 (passkey graduate wallets) of the APAC phase spec
(`docs/superpowers/specs/2026-06-12-apac-hackathon-phase-design.md` §4).

**Why now:** Mainnet access is granted on request and may take days–weeks. Requesting in
Week 1 protects the Week 3–4 schedule. Fallback if not granted by Week 4 (spec §11):
passkeys demoed on testnet; mainnet payout recipient is a Freighter classic address,
clearly badged.

## Checklist (maintainer)

- [ ] Claim a **testnet** token per the Launchtube README (testnet instance is open).
- [ ] Request **mainnet** credits: Stellar Developers Discord (#passkeys / Launchtube
      channels) or SDF developer relations — check the Launchtube README for the current
      route. Draft message below.
- [ ] Store credentials **server-side only**: `LAUNCHTUBE_URL`, `LAUNCHTUBE_JWT` in
      `.env.local` locally and Vercel encrypted env in prod. Never `NEXT_PUBLIC_*`,
      never committed (master-plan Working Agreement rule 4).

## Draft request

> Hi — I'm building **Stellaroid Earn** (stellaroid.tech), a non-custodial
> credential-verification + payout rail on Soroban (Top 5, Stellar PH Bootcamp 2026),
> now targeting the APAC Stellar Hackathon finale in late July. We're adding passkey
> smart wallets for graduates via passkey-kit and need Launchtube mainnet credits for
> fee-sponsored wallet creation + transaction submission during the demo. Expected
> volume: low hundreds of transactions. Could you point me to the right access flow?

## Where the values land later (Week 3 task, not now)

Server-only config reads in `frontend/src/lib/config.ts`, consumed by the passkey
server module. No client exposure.
