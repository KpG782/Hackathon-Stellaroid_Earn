# Stellaroid Earn — Testnet Setup & Testing Guide (explained simply)

This guide walks you through running the app on your computer and testing **every
feature**, step by step, in plain language. No prior blockchain knowledge needed.

> **Golden rule:** test everything on **testnet** first. Testnet is a practice playground
> with pretend money — you can't lose anything real. Only go to mainnet (real money) at the
> very end, after everything works here.

---

## Part 0 — What is this thing? (the 1-minute version)

Imagine a **diploma that can't be faked** and that, once an employer checks it's real,
**instantly unlocks a payment**. That's Stellaroid Earn.

A few words you'll see, in plain terms:

| Word | What it really means |
|---|---|
| **Blockchain** | A shared notebook that everyone can read and nobody can erase or fake. |
| **Stellar** | The specific blockchain we use. Fast and very cheap. |
| **Testnet** | A practice copy of Stellar with **fake money**. Mistakes cost nothing. |
| **Mainnet** | The real one, with **real money**. We save this for last. |
| **Wallet** | Your digital ID + pocket. We use one called **Freighter** (a browser add-on). |
| **Credential** | The digital "diploma" / certificate (e.g. "finished the bootcamp"). |
| **Proof page** | The public web page anyone can open to check a credential is real. |
| **Smart contract** | A vending machine on the blockchain: set the rules once, it runs itself. |
| **USDC** | "Digital dollars" — a stable coin worth ~$1. |
| **Passkey** | Sign in / make a wallet with your **fingerprint or Face ID** (no password). |

The whole demo, in order: a graduate gets a credential → an employer checks it's real →
the employer sends money → everyone can verify it, even with the **internet turned off**.

---

## Part 1 — What you need before you start

1. **A computer** (Mac, Windows, or Linux).
2. **Node.js** installed (version 22 or newer). Check by opening a terminal and typing
   `node --version`. If it's missing, install from <https://nodejs.org>.
3. **Google Chrome** (or any Chromium browser) — for the wallet add-on.
4. **15–30 minutes.** That's it.
5. *(Only for the passkey part, later)* a **phone** with a fingerprint/Face ID.

---

## Part 2 — Get the app running on your computer

Open a **terminal** (on Mac: the "Terminal" app; on Windows: "PowerShell").

**Step 1 — Go into the app folder.** Go to wherever you downloaded this project, then into
its `frontend` folder. Type this and press Enter (swap in your own path):

```bash
cd path/to/Hackathon-Stellaroid_Earn/frontend
```

**Step 2 — Download the building blocks.** This grabs all the code pieces the app needs.
It takes a minute or two the first time:

```bash
npm install
```

**Step 3 — Check the settings file.** There's a hidden file called `.env.local` that tells
the app which network to use. Yours is already set to **testnet** — good. (You can peek with
`cat .env.local`. It should say `NEXT_PUBLIC_STELLAR_NETWORK=TESTNET`.)

**Step 4 — Start the app:**

```bash
npm run dev
```

**Step 5 — Open it.** In your browser, go to **<http://localhost:3000>**.

✅ **What you should see:** the Stellaroid Earn home page loads. 🎉 The app is now running on
your computer. Leave this terminal window open — closing it stops the app.

---

## Part 3 — Make your practice wallet (Freighter on testnet)

A wallet is how you "sign" actions (like a digital signature). We use **Freighter**.

**Step 1 — Install it.** Go to <https://www.freighter.app/>, click "Add to browser", install.

**Step 2 — Create a wallet.** Open the Freighter add-on (puzzle-piece icon in Chrome →
Freighter). Click "Create new wallet", set a password, and it shows you a **recovery phrase**
(12 secret words). Normally you'd guard these with your life — but this is a **testnet
practice wallet**, so just keep them somewhere for now.

**Step 3 — Switch to Testnet.** In Freighter, find the network dropdown (usually top center)
and choose **Test Net**. ⚠️ This matters — if it's on "Main Net" the app won't match.

**Step 4 — Get free pretend money.** A testnet wallet starts empty. To fill it:
- Easiest: in Freighter, there's often a "Fund with Friendbot" button on testnet — click it.
- Or open <https://friendbot.stellar.org>, paste your wallet address (the `G…` code from
  Freighter), and submit.

✅ **What you should see:** your Freighter balance shows ~10,000 XLM (fake). That's your
practice money for transaction fees.

---

## Part 4 — Test each feature (the main flows)

For each test: **what it is** → **what to do** → ✅ **what you should see**.

### 4.1 — Install the app like a phone app (PWA)
**What it is:** the website can be installed like a real app and even work offline.
**Do:** on <http://localhost:3000>, look in the browser address bar for an "install" icon
(a little screen/＋). Click it → Install.
✅ It opens in its own window, no browser bars. (This is the "PWA".)

### 4.2 — The offline trick
**What it is:** even with no internet, the app shows a friendly page instead of breaking.
**Do:** load the site once. Then turn off your wifi (or use the browser's "Offline" toggle
in DevTools → Network). Now click to a page you haven't visited.
✅ You see a clean **"You're offline"** page, not a browser error. Turn wifi back on to undo.

### 4.3 — The whole money loop: register → verify → pay
**What it is:** the heart of the app. A credential gets created on the blockchain, checked,
and paid.
**Do:** go to **<http://localhost:3000/app>**.
1. Click **Connect Freighter**. Approve the popup. Your `G…` address appears — you're in.
2. **Register a credential** — fill the register form and submit. Freighter pops up asking
   you to **sign**; approve it. (This writes the credential to the testnet blockchain. It
   costs a tiny bit of your fake XLM.)
3. **Verify it** — the app reads it back from the blockchain and marks it verified/approved.
4. **Pay** — switch to the **Employer** option, type an amount (e.g. `10`), and click
   **Pay Student**. Approve in Freighter.
✅ You should see a **"Payment settled"** style confirmation and a **"View your proof"** link.
This means the full loop worked on testnet. 🎉

### 4.4 — The public proof page
**What it is:** the shareable "diploma" web page anyone can open — no login.
**Do:** click the **View proof** link from the last step, OR open this ready-made sample:
**<http://localhost:3000/proof/c02ce1602d5bbb6ddfe93c6603d7f4e3dae3b2fb571ea4e70669ccd5a359aea3>**
✅ You see the credential details, a QR code, and verification info.

### 4.5 — The machine-readable version
**What it is:** the same proof in a format computers/robots understand (for AI hiring agents).
**Do:** open the sample proof URL above and add `/credential.json` to the end.
✅ Your browser shows structured text (JSON) describing the credential.

### 4.6 — The "verify a credential" scanner
**What it is:** the page an **employer** uses to check a credential, even offline.
**Do:** go to **<http://localhost:3000/verify>**. (On a laptop with no camera it'll say so —
that's fine; use the boxes below the camera area.)
- In the **Paste code** box, type some nonsense like `hello` and click **Verify pasted code**.
✅ You see a red **"Malformed QR code"** result with "Scan again" — meaning the safety checks
work. (Seeing the **green success** state needs a signed demo credential — see 4.8.)

### 4.7 — Create a payout link (the employer side)
**What it is:** a link an employer shares that only pays out once the credential checks out.
**Do:** find the **employer** area (e.g. <http://localhost:3000/employer>) and the
"Create a payout link" form. Enter:
- the **certificate hash** (paste the sample hash from 4.4),
- a **recipient** wallet (`G…` — paste your own Freighter address),
- pick **USDC** or **XLM**, and an amount.
Click **Create payout link**.
✅ You get a shareable link + QR. Open it → it shows the payout page with a live checklist
("credential verified", "payment detected", etc.).

### 4.8 — *(Optional, unlocks the best demo moment)* Sign the demo credential
**Why:** to see the green **"Verified offline"** badge and the graduate's offline QR, the
sample credential needs a digital signature. This needs the **issuer's secret key**.
**Do (only if you have that key):**
```bash
DEMO_ISSUER_SECRET=S...your-issuer-secret... \
  npm run ops:sign-credential -- c02ce1602d5bbb6ddfe93c6603d7f4e3dae3b2fb571ea4e70669ccd5a359aea3
```
Copy the printed `issuerSignature` block, paste it into the sample entry in
`src/lib/proof-metadata.ts`, and restart the app. Now the proof page shows an **offline QR**,
and scanning/pasting it at `/verify` shows the **green** success result. 🟢

### 4.9 — The status dashboard
**What it is:** a control panel showing if everything is healthy.
**Do:** open **<http://localhost:3000/status>**.
✅ You see green check rows, including **"Network · Testnet"** and the active RPC provider.

---

## Part 5 — The advanced flows (need a little more setup)

These are real but need extra pieces, so they're separate. Skip them for a first pass.

### 5.1 — Pay with real testnet USDC
By default the pay loop uses XLM. To test **USDC** detection end to end you need actual
testnet USDC in the sender's wallet:
1. In Freighter (testnet), add a **trustline** to USDC (issuer
   `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`).
2. Get testnet USDC from Circle's testnet faucet.
3. Make a payout link with **USDC** selected, then send that USDC to the recipient.
✅ The payout page flips to "payment detected" using the USDC path.

### 5.2 — Passkey wallets (fingerprint / Face ID) — needs a phone
This is hidden until you provision two things, because it can't run on a laptop:
1. Deploy the passkey **wallet contract** to testnet and put its hash in
   `NEXT_PUBLIC_PASSKEY_WALLET_WASM_HASH`.
2. Set up a **relayer** (pays the fees) and fill `PASSKEY_RELAYER_URL` +
   `PASSKEY_RELAYER_API_KEY`.
3. Open `/app` **on a real phone** → a "Passkey wallet" panel appears → "Create passkey
   wallet" → your phone asks for fingerprint/Face ID → you get a wallet address with no
   seed phrase and no fees.
✅ Send testnet USDC to that wallet address → the payout page detects it via the
smart-contract-event path. (Details: `docs/superpowers/plans/2026-06-13-week3-passkey-wallets.md`.)

---

## Part 6 — When everything passes: going to real money (mainnet)

**Do not start here.** Only after all of Part 4 (and the parts of 5 you want) work on testnet.
Mainnet also needs a one-time contract change shipped first. The full checklist is in
**`docs/ops/mainnet-activation-runbook.md`** — including the instant **pause switch**
(`ENABLE_MAINNET_PAYMENTS=false`) so you can stop real payouts at any moment.

---

## Part 7 — If something goes wrong (common fixes)

| Problem | Likely fix |
|---|---|
| Page won't load at localhost:3000 | Is `npm run dev` still running in the terminal? Restart it. |
| "Connect Freighter" does nothing | Install Freighter; make sure it's **unlocked**. |
| "Wrong network" warning | Switch Freighter to **Test Net** (Part 3, Step 3). |
| A transaction fails | Your wallet may be out of fake XLM — re-fund with Friendbot. |
| `/verify` only shows red results | Normal until you sign the demo credential (4.8). |
| Passkey panel doesn't show | Expected — it's off until you set the env in 5.2. |

---

## Quick testnet checklist (tick these off)

- [ ] App runs at localhost:3000 (`npm run dev`)
- [ ] Freighter installed, on **Test Net**, funded with Friendbot
- [ ] PWA installs; offline page shows with wifi off (4.1, 4.2)
- [ ] register → verify → pay loop completes with "Payment settled" (4.3)
- [ ] Proof page + `credential.json` load (4.4, 4.5)
- [ ] `/verify` rejects garbage with a clear error (4.6)
- [ ] Payout link creates and opens (4.7)
- [ ] *(optional)* demo credential signed → green offline verify (4.8)
- [ ] `/status` is green and says "Network · Testnet" (4.9)
- [ ] *(advanced)* USDC and/or passkey flows (Part 5)
