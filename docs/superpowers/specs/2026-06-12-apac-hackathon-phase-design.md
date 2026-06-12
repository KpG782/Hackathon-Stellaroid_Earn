# Stellaroid Earn — APAC Hackathon Phase Design (v1, 2026-06-12)

**Status:** approved direction, pending spec review
**Target:** APAC Stellar Hackathon (Rise In × Stellar) — finale late July 2026, up to $60K, PH/Vietnam/Indonesia. Tracks: cross-border payments, stablecoin payroll/savings/transfers, DeFi on Soroban, digital wallets & identity tools, localized fiat on/off-ramps.
**Builds on:** completed v2 master plan (`setup/master-plan.md`) — all P0/P1 + M-1 shipped on `codex/pwa-ops-master-plan`. The Working Agreement in that spec (non-custodial always, proof loop is sacred, secrets server-only, honest UX, mock-first PDAX) carries over unchanged.

---

## 1. Decisions locked (maintainer, 2026-06-12)

1. **Mainnet anchoring + real wallet-to-wallet payments** for the demo. Maintainer flips `STELLAR_NETWORK`/`ENABLE_MAINNET_PAYMENTS`; PDAX stays mock/staging (G3 not assumed).
2. **PWA first** for the finale; **native mobile after** (Expo/React Native chosen over Flutter — see §8).
3. **Offline-first architecture is core**, extended into offline *verification*, not offline payments.

## 2. Market rationale & honest assessment

Competitive intel from the PH leg (May 23, 2026, Demo Day at PDAX HQ): grand prize **AbotPera** (offline/zero-data payments), 1st RU **PinkRaft** (AI dev tooling), 2nd RU **Axial** (MSME compliance/receivables), Best Use of Stellar **Sobre** (stablecoin OFW envelopes). 28 of 32 submissions deployed to mainnet — mainnet is table stakes, offline-first is validated, and the payments lane is crowded.

### Why this product matters (the bull case)

1. **Credential fraud is a real, growing cost.** Fake diplomas and certificates are endemic in PH/APAC hiring; verification is manual, slow (apostille/red-ribbon for OFWs), and intermediated. Generative AI makes it worse: when CVs, portfolios, and certificate images are free to fake, **cryptographic provenance becomes the scarce good**. Verification demand rises with AI, not despite it.
2. **Credentials alone never monetized — the payout fusion is the novelty.** Blockcerts (2016), OpenCerts (Singapore, government-backed), and EBSI (EU) all proved blockchain credentials *work* and still struggled, because verification is a cost center. Stellaroid closes the loop to money: a verified credential *unlocks a payout*. The credential is not the product; **the trust-to-payment rail is.**
3. **The AI-agent labor market needs exactly this substrate.** As employers deploy AI agents to screen, hire, and pay contributors (x402/MPP agentic payments on Stellar drew ~260 projects in April 2026), agents cannot trust PDFs or LinkedIn claims — they need machine-readable, cryptographically verifiable credentials and machine-executable payment. Stellaroid already emits W3C VC / Open Badges 3.0 JSON-LD. We are positioned as **the trust layer agents consume**, not another app with AI bolted on.
4. **Region fit.** Stablecoin payroll/remittance is the proven APAC wedge (Sobre's win; the hackathon's own tracks). Non-custodial design stays clean under PH CASP rules — no ₱100M license dependency.

### Honest cons (senior-dev hat on)

1. **Two-sided cold start is the real risk, not tech.** Proofs are worthless until issuers issue. Mitigation/wedge: bootcamp cohorts themselves (Rise In runs them in 3 countries) are the natural first issuers — issue credentials for the very hackathon's participants.
2. **The blockchain-credential graveyard is real.** Differentiation must stay on the payout + agent rails; if the pitch drifts to "certificates on chain," we're a 2016 product.
3. **Crypto payroll is niche today.** GCash/Maya dominate local payroll. The wedge is Web3-native work, bounties, and cross-border microwork — not replacing domestic payroll on day one. The demo and copy must say this honestly.
4. **AI-grading is deliberately excluded.** We do not let AI assess skill (liability, gameability, and PinkRaft already owns the AI-tooling lane). AI *consumes and routes* trust here; issuers and chains *create* it. That is the defensible division of labor.

**Verdict:** the 6-week scope is justified for the hackathon and the thesis survives senior scrutiny *if framed as "the trust-and-payment rail for an AI-era labor market."* The hackathon is the cheapest possible test of the riskiest assumption (issuer/employer demand).

## 3. Pillar 1 — Offline-first PWA with two-party offline verification ("Job Fair Mode")

Extends the P2-1 Serwist plan into a demoable, novel loop. AbotPera proved offline *payments*; nobody shipped offline *trust*.

- **PWA shell:** `@serwist/next`; precache app shell; stale-while-revalidate for `/proof/*` and `credential.json`; offline fallback page; `reloadOnOnline: false`; prompted refresh via Sonner. SW registered from a tiny client component so the nonce CSP in `src/middleware.ts` is preserved. Install prompt + manifest + icons.
- **Issuer signature on credentials:** at issue time, the issuer signs the canonical credential JSON with their existing Stellar key via Freighter `signMessage` (SEP-43). The signature is stored alongside proof metadata and embedded in `credential.json`. **Labeling is honest:** this is an offline-verifiable issuer signature, not a W3C Data Integrity cryptosuite; `eddsa-jcs-2022` remains roadmap. No new key infrastructure: `issuer-registry.ts` already maps issuer → Stellar address, so the registry doubles as the offline trust root.
- **Offline QR handshake:** graduate's phone renders a self-contained QR: credential JSON + signature, deflate-compressed, base45-encoded (EU Digital COVID Certificate pattern; payload budget ≤ ~1.8KB verified in week 2). Employer's installed PWA scans (camera) and verifies ed25519 offline against the cached issuer-registry snapshot. Result badge: **"verified offline against registry snapshot from HH:mm — reconnect to re-verify on-chain."** On reconnect, background re-verify upgrades the badge to on-chain status. Honest-UX rule 7 applies: offline result is never presented as final.
- **Web NFC** (Chrome Android only) as progressive enhancement: tap-to-transfer the same payload. QR is the primary path on all platforms (iOS has no Web NFC).
- **Config note:** `Permissions-Policy` currently denies camera globally; scope-allow camera on the scanner route only. CSP and other headers unchanged.

**Tests:** payload encode/decode round-trip + size budget; signature verify (golden vectors + tamper rejection); registry-snapshot staleness badging; SW registration under CSP (e2e); offline render of cached proof (Playwright offline emulation).

## 4. Pillar 2 — Passkey smart wallets for graduates

The current graduate flow requires Freighter — a desktop extension, a dead end on mobile. Replace it **for graduates only**; employers/issuers keep the shipped Freighter flow.

- **passkey-kit** (client) + **Launchtube** (fee-sponsored submission): Face ID/fingerprint creates a Soroban smart-wallet contract account; the graduate needs zero XLM, zero extension, zero seed phrase. The wallet's contract address becomes the payout recipient; it receives USDC via the Stellar Asset Contract with no trustline step.
- Server pieces (PasskeyServer/Launchtube token) live server-only, consistent with Working Agreement rule 4.
- **Week-1 external dependency:** request mainnet Launchtube credits (SDF). Fallback if unavailable by week 4: passkeys demoed on testnet; mainnet payout recipient is a Freighter classic address — clearly badged, demo arc unchanged.
- Wallet code stays dynamic-imported so landing/proof routes keep zero wallet bytes (P1-3 invariant, verified by bundle analyzer).

**Tests:** wallet-creation flow (mock WebAuthn in unit tests; real device in e2e manual checklist); recipient-address derivation; bundle-isolation check.

## 5. Pillar 3 — Mainnet activation with USDC payouts

- **Contract change before mainnet deploy (one-way door):** add `revoked` storage flag + issuer-only `revoke()` (pulls the storage half of P2-2 forward; the Bitstring Status List endpoint remains post-hackathon). "The contract is the DB" and the mainnet contract is permanent — ship the field now.
- **Activation per the master plan's gates, honestly executed:** internal security review documented in `docs/audit/` (explicitly labeled *internal review, not an independent audit* — satisfies the M-2 tripwire as a maintainer decision); G4 runbook: mainnet RPC provider list for the P0-1 router, funding checklist for demo wallets (XLM reserves + USDC), spend caps in copy, kill-switch = `ENABLE_MAINNET_PAYMENTS=false`, `/status` shows network + provider. Maintainer sets mainnet env in Vercel; nothing mainnet is committed.
- **USDC payout asset:** intent token gains `asset: "XLM" | "USDC"` (version the token; old tokens remain valid as XLM). Payment detection extends from native-XLM matching to USDC payment ops. `FiatValue` quotes USDC→PHP through the existing quote chain (CoinGecko id `usd-coin`; PDAX rail unchanged/mock). Employer "create payout link" UI gains an asset selector defaulting to USDC with ₱ framing.
- Demo uses small real amounts; wallet-to-wallet only; the app never signs, routes, or holds funds on any network.

**Tests:** asset-aware payment matching (amount tolerance, wrong-asset rejection, time window); intent token versioning round-trip; mainnet path via injected config (M-1 precedent — no live mainnet calls in CI); reconcile script extended to assert asset.

## 6. Pillar 4 (stretch ladder — build top-down only if weeks 1–4 are green)

The deliberate AI×Web3 angle: **agents consume our trust, they don't create it.**

1. **MCP server (cheapest, ~1–2 days):** expose `verify_credential(hash)` and `create_payout_intent(...)` as MCP tools wrapping existing endpoints. Demo: a hiring agent (Claude) screens a candidate live — calls Stellaroid, verifies on mainnet, returns the payout link. Huge judge optics for tiny surface.
2. **x402-gated verification API:** premium/bulk verification endpoint returns HTTP 402 with payment requirements; an agent pays small USDC on Stellar and receives attested verification. Rides the exact x402/MPP momentum from the Stellar Agents hackathon.
3. **Policy payroll (deepest):** employer smart-wallet **policy signer** authorizing auto-release up to a per-credential cap when a credential from an allowlisted issuer verifies. Credential-triggered programmatic payroll, still self-custodial (the employer's own wallet enforces its own policy). Contract-adjacent work — design here, build only with full green board and rehearsal time.

Each rung is independently demoable and independently droppable.

## 7. Out of scope (this phase)

AI skill assessment/grading · marketplace/LMS · DB (state stays chain + signed tokens) · login on public proof routes · custody (never, any network) · PDAX production (G3) · Bitstring Status List endpoint · Flutter/native app before the finale · committing any mainnet/production env value.

## 8. Native mobile roadmap (post-finale, August 2026)

**Expo/React Native, not Flutter:** the entire `lib/` layer (intent tokens, quote chain, validators, contract patterns) is TypeScript and `@stellar/stellar-sdk` is JS — RN reuses it via a shared package; Flutter means a Dart rewrite against a different SDK. Plan: extract `lib/` core to a workspace package → Expo shell → native passkeys → same offline-first model (local cache + background re-verify). The finale's mobile story is the installed PWA.

## 9. Timeline (finale ~late July; freeze week 6)

| Week | Deliverable |
|---|---|
| 1 (Jun 15) | Merge `codex/pwa-ops-master-plan` → main; register team; **request Launchtube mainnet credits**; Serwist shell + manifest + offline page |
| 2 | Issuer SEP-43 signature in issue flow + `credential.json`; offline QR encode/verify loop end-to-end; camera permission scoping |
| 3 | Passkey graduate wallets on testnet; payout recipient integration |
| 4 | Mainnet: contract +`revoked` deploy, anchoring live, payments flag, USDC intents + detection, runbook + internal review in `docs/audit/` |
| 5 | Polish; Web NFC flourish; stretch ladder top-down; demo script v2 |
| 6 (~Jul 20) | Freeze; rehearse 3-min demo; submission materials (video, README, deck) |

## 10. Demo arc (3 minutes)

1. Grad creates a wallet with a fingerprint — no seed phrase, no extension, no XLM (identity track).
2. Issuer anchors the credential on **mainnet**; public proof URL + standards-shaped `credential.json`.
3. **Airplane mode on** — employer's installed PWA verifies the grad's QR fully offline; badge says so honestly. Reconnect → badge upgrades to on-chain.
4. Employer sends **real USDC on mainnet** via credential-gated payout link; page detects it live; ₱ value shown; off-ramp guide (non-custodial CASP line: "we are the GPS, never the taxi").
5. (Stretch) hiring agent verifies + prepares a payout via MCP/x402.
6. Encore: pull-the-plug RPC failover stays green.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Launchtube mainnet access delayed | Request week 1; fallback: passkeys on testnet + Freighter recipient on mainnet, badged |
| QR payload exceeds scannable size | Deflate+base45 budget test in week 2; fallback: URL-QR + verifier-side cached credential |
| iOS gaps (no Web NFC; PWA quirks) | QR is primary everywhere; test installed-PWA WebAuthn on iOS 17+ early (week 3) |
| Mainnet demo funds/ops mistakes | Runbook + funding checklist + spend caps + kill-switch; small amounts only |
| Stretch ladder eats polish time | Hard gate: only if weeks 1–4 green; each rung droppable |
| Overclaiming standards/AI | Copy review: SEP-43 sig ≠ DI cryptosuite; "internal review" ≠ audit; agents consume trust, never grade skill |
