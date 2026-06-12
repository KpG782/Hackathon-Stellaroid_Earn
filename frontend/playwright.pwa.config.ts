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
