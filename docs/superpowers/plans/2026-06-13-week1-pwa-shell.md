# Week 1 — PWA Shell + Mainline Merge + Launchtube Prep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Week 1 of the APAC-hackathon phase (spec: `docs/superpowers/specs/2026-06-12-apac-hackathon-phase-design.md` §3, §9): merge the completed master-plan branch to main, add the Serwist offline-first PWA shell (service worker, offline fallback page, update prompt) without breaking the nonce CSP, and prepare the Launchtube access request.

**Architecture:** `@serwist/next` wraps the Next config and compiles `src/app/sw.ts` → `public/sw.js` at build time (disabled in dev). The SW precaches the offline fallback document, runs stale-while-revalidate over `/proof/*`, and uses Serwist's `defaultCache` for everything else. Registration happens in a tiny `"use client"` component (compiled bundle code → no CSP nonce needed); updates surface as a Sonner toast (`skipWaiting: false`, `reloadOnOnline: false` per spec). `sw.js` is excluded from the CSP middleware matcher so no document CSP attaches to the worker context. PWA e2e runs against a production build via a dedicated Playwright config because the SW is disabled under `next dev`.

**Tech Stack:** Next.js 15 (App Router, webpack build), `@serwist/next` + `serwist` (v9), Sonner (already installed), Playwright (existing), Node built-in test runner (existing, unaffected).

**User actions this week (not agent work):** register the team at risein.com/programs/apac-stellar-hackathon; send the Launchtube request drafted in Task 1.

---

## File map

| Action | Path | Responsibility |
|---|---|---|
| Create | `docs/ops/launchtube-request.md` | External-dependency checklist + request draft |
| Create | `frontend/src/app/sw.ts` | Service worker source (precache, runtime caching, offline fallback) |
| Create | `frontend/src/app/~offline/page.tsx` | Offline fallback document |
| Create | `frontend/src/components/pwa/sw-register.tsx` | CSP-safe SW registration + update toast |
| Create | `frontend/playwright.pwa.config.ts` | Prod-build Playwright config for PWA tests |
| Create | `frontend/e2e/pwa.spec.ts` | Manifest / SW / offline e2e |
| Modify | `frontend/next.config.ts` | Wrap with `withSerwist` |
| Modify | `frontend/src/app/layout.tsx` | Mount `<SwRegister />` |
| Modify | `frontend/src/middleware.ts` | Exclude `sw.js` from CSP matcher |
| Modify | `frontend/playwright.config.ts` | Ignore `pwa.spec.ts` in the dev-server e2e run |
| Modify | `frontend/package.json` | Deps + `test:e2e:pwa` script |
| Modify | `frontend/.gitignore` | Ignore generated `public/sw.js*` |
| Modify | `frontend/README.md` | Feature rows for `/~offline` + PWA ops note (DoD) |

`/status` is intentionally untouched: the SW adds no server-side operational surface (DoD note for reviewers).

---

### Task 0: Merge `codex/pwa-ops-master-plan` → `main`, branch for Week 1

**Files:** none (git only)

- [ ] **Step 0.1: Verify clean tree and no divergence**

```bash
cd /Users/kuya/Documents/STELLAR/Hackathon-Stellaroid_Earn
git status --porcelain          # expect: empty
git fetch origin
git log --oneline codex/pwa-ops-master-plan..origin/main
```

Expected: the last command prints **nothing** (main has no commits the branch lacks). If it prints commits, STOP — main diverged; rebase/merge decision goes back to the user.

- [ ] **Step 0.2: Merge with a merge commit**

```bash
git checkout main
git merge --no-ff codex/pwa-ops-master-plan -m "merge: PWA ops master plan (P0-1..5, P1-1..4, M-1)"
```

- [ ] **Step 0.3: Run the full gates on merged main**

```bash
cd frontend && npm run lint && npm run test:unit && npm run build
```

Expected: lint clean, 77/77 unit tests pass, build succeeds. If anything fails, STOP and fix before pushing.

- [ ] **Step 0.4: Push main, then branch for Week 1**

```bash
cd /Users/kuya/Documents/STELLAR/Hackathon-Stellaroid_Earn
git push origin main
git checkout -b feat/pwa-shell
```

---

### Task 1: Launchtube access checklist + request draft

**Files:**
- Create: `docs/ops/launchtube-request.md`

- [ ] **Step 1.1: Write the doc**

```markdown
# Launchtube Access — Week 1 External Dependency

**What:** Launchtube (github.com/stellar/launchtube) submits Soroban transactions and
covers fees/sequence handling, so passkey smart-wallet users need zero XLM. Required for
Pillar 2 (passkey graduate wallets) of the APAC phase spec.

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
```

- [ ] **Step 1.2: Commit**

```bash
git add docs/ops/launchtube-request.md
git commit -m "docs(ops): add Launchtube access checklist and request draft"
```

---

### Task 2: Failing PWA e2e (red)

**Files:**
- Create: `frontend/playwright.pwa.config.ts`
- Create: `frontend/e2e/pwa.spec.ts`
- Modify: `frontend/playwright.config.ts` (ignore pwa spec in dev-mode runs)
- Modify: `frontend/package.json` (script)

- [ ] **Step 2.1: Create `frontend/playwright.pwa.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

const PORT = 3008;
const baseURL = `http://127.0.0.1:${PORT}`;
const E2E_READ_ADDRESS =
  "GAWIOVGFSPJDEIJJZUSVRFPVP3D5VNO2LGCU47KEHJD6MV277QKNR34D";

// The service worker is disabled under `next dev`, so PWA tests run against a
// production build. Kept separate from playwright.config.ts to keep the fast
// dev-server suite fast.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /pwa\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_E2E_MODE: "1",
      NEXT_PUBLIC_PLAYWRIGHT: "1",
      NEXT_PUBLIC_SOROBAN_CONTRACT_ID:
        "CD7J5J6EJ6G6PU4ORLQR5XULX2R6S44B4WRQXWQL4MNP2J7YJ3UQTEST",
      NEXT_PUBLIC_STELLAR_READ_ADDRESS: E2E_READ_ADDRESS,
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

- [ ] **Step 2.2: Create `frontend/e2e/pwa.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test.describe("PWA shell", () => {
  test("serves a valid web app manifest", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.name).toBe("Stellaroid Earn");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  test("registers the service worker", async ({ page }) => {
    await page.goto("/");
    const swUrl = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.active?.scriptURL ?? null;
    });
    expect(swUrl).toContain("/sw.js");
  });

  test("falls back to the offline page for uncached navigations", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      return true;
    });
    // Reload so the page is controlled by the active SW before going offline.
    await page.reload();
    await context.setOffline(true);
    await page.goto("/metrics");
    await expect(
      page.getByRole("heading", { name: /offline/i }),
    ).toBeVisible();
    await context.setOffline(false);
  });
});
```

- [ ] **Step 2.3: Keep the dev-server suite ignorant of the pwa spec — modify `frontend/playwright.config.ts`**

Add one line inside `defineConfig({ ... })`, directly under `testDir: "./e2e",`:

```ts
  testIgnore: /pwa\.spec\.ts/,
```

- [ ] **Step 2.4: Add the script — modify `frontend/package.json`**

In `"scripts"`, after `"test:e2e": "playwright test",` add:

```json
    "test:e2e:pwa": "playwright test --config playwright.pwa.config.ts",
```

- [ ] **Step 2.5: Run to verify red**

```bash
cd frontend && npm run test:e2e:pwa
```

Expected: manifest test PASSES (manifest.ts already exists); the two service-worker tests FAIL (`navigator.serviceWorker.ready` times out — no SW is built yet). That failure is the red state.

---

### Task 3: Serwist service worker + offline page + registration (green)

**Files:**
- Modify: `frontend/next.config.ts`
- Create: `frontend/src/app/sw.ts`
- Create: `frontend/src/app/~offline/page.tsx`
- Create: `frontend/src/components/pwa/sw-register.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/middleware.ts`
- Modify: `frontend/.gitignore`

- [ ] **Step 3.1: Install**

```bash
cd frontend && npm install @serwist/next serwist
```

Expected: v9.x of both; no peer warnings against Next 15.

- [ ] **Step 3.2: Wrap the Next config — modify `frontend/next.config.ts`**

Add after the existing `bundleAnalyzer` import:

```ts
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // Spec P2-1: never hard-reload under the user; updates go through the
  // Sonner prompt in sw-register.tsx instead.
  reloadOnOnline: false,
  // App Router pages are not in the build precache manifest; the offline
  // fallback document must be added explicitly.
  additionalPrecacheEntries: [{ url: "/~offline", revision: crypto.randomUUID() }],
});
```

Change the export line from:

```ts
export default withBundleAnalyzer(nextConfig);
```

to:

```ts
export default withSerwist(withBundleAnalyzer(nextConfig));
```

- [ ] **Step 3.3: Create `frontend/src/app/sw.ts`**

```ts
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // skipWaiting stays false: a new SW activates only after the user accepts
  // the update toast (sw-register.tsx posts SKIP_WAITING, which Serwist
  // handles natively).
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Public proof pages and their credential.json stay readable offline.
      // 64-hex gate mirrors the route's own hash validation.
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && /^\/proof\/[0-9a-f]{64}(\/|$)/i.test(url.pathname),
      handler: new StaleWhileRevalidate({
        cacheName: "proof-pages",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
```

- [ ] **Step 3.4: Create `frontend/src/app/~offline/page.tsx`**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-2xl text-text">You&apos;re offline</h1>
      <p className="max-w-md text-sm text-text-muted">
        This page isn&apos;t cached yet. Proof pages you opened before are still
        available offline &mdash; and reconnecting re-verifies everything
        on-chain.
      </p>
    </main>
  );
}
```

- [ ] **Step 3.5: Create `frontend/src/components/pwa/sw-register.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { toast } from "sonner";

// Registers the service worker from compiled bundle code so the nonce-based
// CSP in src/middleware.ts is never involved (no inline script).
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    const promptUpdate = (registration: ServiceWorkerRegistration) => {
      const waiting = registration.waiting;
      if (!waiting) return;
      toast("Update available", {
        description: "A new version of Stellaroid is ready.",
        duration: Infinity,
        action: {
          label: "Refresh",
          onClick: () => waiting.postMessage({ type: "SKIP_WAITING" }),
        },
      });
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        promptUpdate(registration);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          installing?.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              promptUpdate(registration);
            }
          });
        });
      })
      .catch(() => {
        // PWA is progressive enhancement; registration failures stay silent.
      });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  return null;
}
```

- [ ] **Step 3.6: Mount it — modify `frontend/src/app/layout.tsx`**

Add to the imports block:

```tsx
import { SwRegister } from "@/components/pwa/sw-register";
```

Add inside `<body>` directly after `<ScrollToTop />`:

```tsx
        <SwRegister />
```

- [ ] **Step 3.7: Keep document CSP off the worker script — modify `frontend/src/middleware.ts`**

In the `config.matcher` source string, add `sw.js|` after `logo.svg|`:

```ts
      source:
        "/((?!_next/static|_next/image|favicon.ico|favicon-48.png|favicon.png|apple-touch-icon.png|logo.svg|sw.js|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|map)$).*)",
```

Why: a `Content-Security-Policy` header on the `sw.js` response would govern the
worker's own fetches (`connect-src 'self' https://*.stellar.org` would block
runtime-cache fetches such as Google Fonts). Document CSP for pages is unchanged.

- [ ] **Step 3.8: Ignore generated worker output — modify `frontend/.gitignore`**

Append:

```
# Serwist build output (generated by next build)
public/sw.js
public/sw.js.map
public/swe-worker-*.js
```

- [ ] **Step 3.9: Run PWA e2e to verify green**

```bash
cd frontend && npm run test:e2e:pwa
```

Expected: 3/3 PASS.

- [ ] **Step 3.10: Run the full gates**

```bash
cd frontend && npm run lint && npm run test:unit && npm run build && npm run test:e2e
```

Expected: lint clean (if the triple-slash reference in `sw.ts` trips
`@typescript-eslint/triple-slash-reference`, add `// eslint-disable-next-line @typescript-eslint/triple-slash-reference`
above it); 77/77 unit; build clean with `public/sw.js` emitted; dev-server e2e 7/7
(pwa spec ignored there).

- [ ] **Step 3.11: Commit**

```bash
git add -A
git commit -m "feat(pwa): offline-first service worker shell with prompted updates (P2-1 core)"
```

---

### Task 4: README rows (Definition of Done)

**Files:**
- Modify: `frontend/README.md`

- [ ] **Step 4.1: Add the route row**

In the `## Routes` table, after the `/status` row, add:

```markdown
| `/~offline` | Offline fallback page served by the service worker for uncached navigations. Cached proof pages stay readable offline; reconnecting re-verifies on-chain. |
```

- [ ] **Step 4.2: Add the ops note**

In the `## Ops` bullet list, add:

```markdown
- **PWA (spec §3):** `@serwist/next` builds `public/sw.js` on `next build` (disabled in dev). Updates are user-prompted via Sonner — no auto reload. `npm run test:e2e:pwa` runs the production-build PWA suite (manifest, SW registration, offline fallback). `sw.js` is excluded from the CSP middleware matcher so no document CSP attaches to the worker.
```

- [ ] **Step 4.3: Commit**

```bash
git add frontend/README.md
git commit -m "docs(readme): feature rows for PWA shell and offline route"
```

---

## Definition of done (from master-plan §6, adapted)

- [ ] 3/3 `test:e2e:pwa` green against a production build
- [ ] `npm run lint && npm run test:unit && npm run build` clean; dev e2e 7/7 untouched
- [ ] CSP + security headers unchanged for documents; `sw.js` matcher exclusion documented
- [ ] README rows added; `/status` untouched (no new server-side surface — noted in file map)
- [ ] Launchtube request doc committed; user action items called out
- [ ] Installable check (manual, post-deploy): Chrome Android → Install app; iOS Safari → Add to Home Screen
