# Stellaroid Earn — Positioning & Market Kit

> Plain-language source of truth for pitches, decks, and the APAC Stellar Hackathon submission
> (finale late July 2026). Technical companion: [`superpowers/specs/2026-06-12-apac-hackathon-phase-design.md`](superpowers/specs/2026-06-12-apac-hackathon-phase-design.md) §2.

**One-liner:** Any skill credential issued on Stellaroid can be verified by anyone in seconds — by a human offline at a job fair, or by an AI agent over the wire — and can have money attached to it, paid wallet-to-wallet with no custodian in the middle.

**Category:** *Workforce trust infrastructure* — verifiable-credential rails at the intersection of **EdTech (who issues) × HR tech (who pays to verify) × fintech (how money moves)**. Hackathon track entry: **digital wallets & identity tools**; secondary: localized fiat on/off-ramps. We are not edtech, legal tech, civic tech, or health tech alone — those are verticals the rail serves.

---

## The universal loop (layman's terms — same three steps in every market)

1. **Issue** — The school or agency clicks "issue." The graduate gets a link + QR on their phone. A fingerprint of the certificate is sealed into a public ledger that no one — not even us — can edit. Like a wax seal in a public book.
2. **Verify** — Anyone who sees the QR or link checks it in seconds: *real, issued by X, on date Y, not revoked.* No account, no phone call to the school — and it works with **no internet** (the phone checks the seal mathematically, then re-confirms online later).
3. **Pay** — The part nobody else does: an employer attaches money to that check. A payout link unlocks **only** for the person whose credential verifies; funds move straight from the employer's wallet to the graduate's wallet. **We are the GPS, never the taxi** — money never passes through us.

**Honest scope:** Stellaroid verifies credentials *issued through the rail*. It cannot validate a legacy paper diploma that was never anchored — coverage grows exactly as fast as issuers adopt. (That is the cold-start risk, and the wedge below is how we beat it.)

---

## The flow in each market

### EdTech — bootcamps & training centers *(entry market)*
- **Today:** A grad gets a PDF. An employer emails the school to confirm it; someone answers days later — or never. Fakes of the school's certificate circulate and damage its name.
- **With Stellaroid:** The school issues once and never answers a verification email again. Its certificates become impossible to fake — brand protection, not just tech.
- **Money moment:** A bootcamp or sponsor pays completion stipends that release only to genuinely certified grads.

### HR / employers *(the paying market)*
- **Today:** HR pays a screening agency and waits days; fraud still slips through (credential-discrepancy rates rose 44% in 2024 per AuthBridge).
- **With Stellaroid:** Candidate shows a QR at an interview or a provincial job fair with zero signal → HR's phone scans → green check on the spot, re-confirmed on-chain when connectivity returns.
- **Money moment:** Hiring a remote/overseas worker, the employer sends the first payment through a credential-gated link, peso value shown. Trust and payment in one motion.

### Civic tech — government skills & licensing agencies *(scale market)*
- **Today:** A citizen in the province needs certified true copies, red-ribbon/apostille queues, and fixers — while fake licenses circulate.
- **With Stellaroid:** The agency seals licenses at issue. Any barangay job fair, recruiter, or overseas office verifies them offline with a phone. No lines, no fixers, no internet at the point of check.
- **Why it matters:** One agency onboarded = millions of verifiable credentials. Distribution play, not near-term revenue.

### Health tech — nurse & health-worker credentialing *(high-value, partner-led, later)*
- **Today:** A Filipino nurse applying abroad waits months and pays fees while agencies verify her license across borders. The Philippines is the world's top nurse exporter.
- **With Stellaroid:** Her school and regulator sealed the license at issue; a foreign hospital scans and confirms in seconds — the same QR pattern the world already used for COVID health passes — and can release her signing bonus through a credential-gated payout.
- **Caution:** Regulated. Enter only with institutional partners.

### Legal tech *(touchpoint only — we do not claim this lane)*
Tamper-proof document fingerprints reduce apostille/notarization friction, but legal tech is not a market we enter.

### The AI layer (plain words)
Companies increasingly let AI assistants screen applicants. Stellaroid credentials are readable by machines too — so an AI recruiter can ask the rail *"is this certificate real?"* and even prepare the payment by itself (MCP / x402 endpoints, spec §6). **We are the trust source the robots consult; we never let robots judge whether a human is skilled.** And generative AI is the tailwind, not the threat: when CVs and certificates are free to fake, cryptographic provenance becomes the scarce good.

---

## Market numbers (third-party estimates — always cite, never invent precision)

| Signal | Figure | Source |
|---|---|---|
| Alternative credentials market | $18.8B (2025) → $69.9B by 2034, 18.6% CAGR | [Fortune Business Insights](https://www.fortunebusinessinsights.com/alternative-credentials-market-110785) |
| Micro-credential courses | $5.5B (2026) → $15B by 2035 | [Business Research Insights](https://www.businessresearchinsights.com/market-reports/micro-credentials-courses-market-119084) |
| Credential-management software | $2.1B (2025) → $7.8B by 2035 | [Future Market Insights](https://www.futuremarketinsights.com/reports/digital-credential-management-software-market) |
| Background checks | $5.8B (2025) → $16.1B by 2034; education verification the fastest-growing slice (~25–28%) | [Dataintelo](https://dataintelo.com/report/background-check-market) · [IMARC](https://www.imarcgroup.com/employment-screening-services-market) |
| Global academic-fraud ecosystem ("problem size") | ~$21B | [Parchment / Rivista Universitas](https://www.parchment.com/blog/global-financial-impact-of-diploma-mills-and-academic-fraud/) |
| Employer demand | 96% say micro-credentials strengthen an application; 90% would offer higher pay | [Business Research Insights](https://www.businessresearchinsights.com/market-reports/micro-credentials-courses-market-119084) |
| PH beachhead | 1.5M+ active freelancers; 6th fastest-growing gig market; IT-BPM $38B revenue / 1.82M jobs | [HireTalent.ph](https://hiretalent.ph/filipino-remote-work-facts/) |

**Beachhead → expansion:** PH cross-border skills work first (bootcamp grads + gig/freelance payouts, where one motion solves trust *and* payment) → civic agencies (scale) → health credentialing (value). Rise In runs bootcamps in all three hackathon countries — the hackathon's own cohorts are the natural first issuers.

**Competitive frame:** Blockcerts (2016), OpenCerts (SG, government-backed), and EBSI (EU) proved blockchain credentials work and still stalled — verification alone is a cost center. Stellaroid's difference is closing the loop to money: **the credential is not the product; the trust-to-payment rail is.**
