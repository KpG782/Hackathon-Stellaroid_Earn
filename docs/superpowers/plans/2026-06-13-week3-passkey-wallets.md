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

## Phase B — Passkey smart-wallet creation (graduate-only)  ✅ implemented (2026-06-13)

Built against the **real** `passkey-kit@0.12.0` API (inspected from the installed types,
not assumed). One correction to the original spec: v0.12 submits through an **OpenZeppelin
Relayer** (`relayerUrl` + `relayerApiKey`, via `@openzeppelin/relayer-plugin-channels`),
**not** the Launchtube JWT the spec named. The fee-sponsorship dependency is therefore a
relayer endpoint; `docs/ops/launchtube-request.md` should be read as "provision a relayer."

**Network-agnostic by env (testnet *and* mainnet from one codebase):**
- `src/lib/passkey-config.ts` (client-safe): `getPasskeyClientConfig` / `passkeysEnabled`
  — passkeys turn on when `NEXT_PUBLIC_PASSKEY_WALLET_WASM_HASH` is a valid 64-hex hash;
  `NEXT_PUBLIC_ENABLE_PASSKEYS=false` force-disables. RPC + passphrase reuse `appConfig`.
- `src/lib/passkey-server.ts` (server-only): `getPasskeyServerConfig` reads
  `PASSKEY_RELAYER_URL` / `PASSKEY_RELAYER_API_KEY` / `PASSKEY_RELAYER_PLUGIN_ID`;
  `submitDeployTransaction` submits the signed deploy XDR via the relayer's `ChannelsClient`
  directly (so the server never loads passkey-kit's browser half / stellar-sdk-minimal).
- The maintainer sets the network's values in Vercel; nothing network-specific is committed.

**Bundle isolation (P1-3), verified by the build:** `passkey-kit` (+ nested
stellar-sdk@14) is reached ONLY through dynamic imports in `src/lib/passkey-wallet.ts`
(client) and via `ChannelsClient` server-side. The `/app` panel (`PasskeyWalletPanel`) is
`next/dynamic({ ssr:false })` and dynamic-imports the wallet lib inside its click
handlers. Build confirms landing `/` (167 kB), `/proof/[hash]` (129 kB), and
`credential.json` (104 kB) First-Load JS are **unchanged** — zero wallet bytes leaked.

**Two build fixes this required (next.config.ts):**
- `transpilePackages: ["passkey-kit","passkey-kit-sdk","sac-sdk"]` — they ship raw TS entries.
- A `webpack.IgnorePlugin` stubbing stellar-sdk@14's contract-bindings `require("../../package.json")` (a codegen-only path that resolves to a nonexistent `lib/package.json` under the bundler and never runs in-browser).

**Flow:** graduate taps "Create passkey wallet" → WebAuthn registration + deploy tx built
client-side (`createGraduateWallet`) → signed XDR POSTed to `/api/passkey/deploy` →
relayer submits (zero XLM) → the wallet **contract address (C)** is shown as the payout
recipient, which the payout loop already accepts (Phase A). `keyIdBase64` is persisted to
`localStorage` for reconnect. Freighter stays the fallback whenever passkeys are off.

**Tests:** orchestration (`createGraduateWallet`/`connectGraduateWallet`) with an injected
fake kit — no library load, no authenticator; config resolution + flag matrix; relayer
submit with an injected sender; XDR shape gate. Unit 124/124. The WebAuthn ceremony and a
live relayer submission are device/infra-bound — see the manual checklist below.

## Manual readiness checklist (per network — what's left to demo live)

CI proves the code path compiles, isolates, and is correctly wired; these steps need real
infra/device and are the same for testnet and mainnet (just different env values):

1. Deploy the passkey-kit smart-wallet contract to the target network; set
   `NEXT_PUBLIC_PASSKEY_WALLET_WASM_HASH` to its WASM hash (this flips passkeys ON).
2. Provision an OZ Relayer (managed or self-hosted) for the network; set
   `PASSKEY_RELAYER_URL` + `PASSKEY_RELAYER_API_KEY` (+ `PASSKEY_RELAYER_PLUGIN_ID=channels`
   if self-hosted). Server-only in Vercel encrypted env.
3. (Optional) Mercury indexer for cross-device reconnect — not required for same-device demo.
4. On a real device (iOS 17+/Android Chrome), open `/app`: Create wallet → Face ID/finger →
   confirm a C-address appears and `/api/passkey/deploy` returns a tx hash; verify the
   wallet exists on-chain; use the address as a payout recipient end-to-end.
5. Mainnet: repeat with mainnet env + small real amounts; kill switch is
   `NEXT_PUBLIC_ENABLE_PASSKEYS=false`.

## Phase C — Payment detection for contract recipients  → Week 4

SAC transfer-event detection (Soroban RPC `getEvents` on the asset contract, filtered by
`to` = wallet address) so payments to a smart wallet are detected live. Tracked with the
Week-4 USDC payout-ops work (spec §5). Phase A's `payment-detect` guards are the seam.

## Gate (this phase, Phase A)

`npm run lint && npm run test:unit && npm run build && npm run test:e2e &&
npm run test:e2e:pwa` — all green; commit; push `feat/pwa-shell`.
