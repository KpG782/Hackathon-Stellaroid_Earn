import { Networks } from "@stellar/stellar-sdk";
import { isE2EModeAllowed } from "./security.ts";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";

const configuredPassphrase =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? TESTNET_PASSPHRASE;
const configuredRpcUrl =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? DEFAULT_RPC_URL;

export const appConfig = {
  rpcUrl: configuredRpcUrl,
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "TESTNET",
  networkPassphrase: configuredPassphrase,
  e2eMode:
    process.env.NEXT_PUBLIC_E2E_MODE === "1" &&
    isE2EModeAllowed({
      nodeEnv: process.env.NODE_ENV,
      ci: process.env.CI === "true",
      playwright: process.env.NEXT_PUBLIC_PLAYWRIGHT === "1",
      vercelEnv: process.env.VERCEL_ENV,
    }),
  contractId: process.env.NEXT_PUBLIC_SOROBAN_CONTRACT_ID ?? "",
  assetAddress: process.env.NEXT_PUBLIC_SOROBAN_ASSET_ADDRESS ?? "",
  assetCode: process.env.NEXT_PUBLIC_SOROBAN_ASSET_CODE ?? "XLM",
  assetDecimals: Number(process.env.NEXT_PUBLIC_SOROBAN_ASSET_DECIMALS ?? "7"),
  explorerUrl:
    process.env.NEXT_PUBLIC_STELLAR_EXPLORER_URL ??
    "https://stellar.expert/explorer/testnet",
  readAddress: process.env.NEXT_PUBLIC_STELLAR_READ_ADDRESS ?? "",
  adminAddress: process.env.NEXT_PUBLIC_STELLAR_ADMIN_ADDRESS ?? "",
  sponsorAddress: process.env.NEXT_PUBLIC_FEE_SPONSOR_ADDRESS ?? "",
};

const networkPassphraseByName: Record<string, string> = {
  TESTNET: Networks.TESTNET,
  PUBLIC: Networks.PUBLIC,
  PUBNET: Networks.PUBLIC,
};

const networkLabelByName: Record<string, string> = {
  TESTNET: "Testnet",
  PUBLIC: "Pubnet",
  PUBNET: "Pubnet",
};

// Circle's canonical USDC issuers per network (overridable for other anchors).
const usdcIssuerByName: Record<string, string> = {
  TESTNET: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  PUBLIC: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  PUBNET: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
};

/** USDC issuer (G-address) for the active network — payment detection keys on it. */
export function getUsdcIssuer(): string {
  return (
    process.env.NEXT_PUBLIC_USDC_ISSUER?.trim() ||
    usdcIssuerByName[appConfig.network] ||
    usdcIssuerByName.TESTNET
  );
}

export function getExpectedNetworkPassphrase() {
  return networkPassphraseByName[appConfig.network] ?? appConfig.networkPassphrase;
}

export function getExpectedNetworkLabel() {
  return networkLabelByName[appConfig.network] ?? appConfig.network;
}

const MAINNET_NETWORKS = new Set(["PUBLIC", "PUBNET"]);

/** True when the deployment targets Stellar mainnet (pubnet). */
export function isMainnet(): boolean {
  return MAINNET_NETWORKS.has(appConfig.network);
}

/**
 * Server-side kill switch for real-money flows (APAC spec §5). Reading it at
 * request time means the maintainer can pause mainnet payouts by flipping the
 * Vercel env — no redeploy. Never NEXT_PUBLIC_* (must not be baked into the
 * client bundle).
 */
export function mainnetPaymentsEnabled(): boolean {
  return process.env.ENABLE_MAINNET_PAYMENTS === "true";
}

/** Pure kill-switch rule (unit-testable independent of the frozen env). */
export function arePaymentsActive(mainnet: boolean, mainnetEnabled: boolean): boolean {
  return !mainnet || mainnetEnabled;
}

/**
 * Whether new payout links may be created right now. Testnet is always active
 * (no real money); mainnet requires the explicit ENABLE_MAINNET_PAYMENTS opt-in.
 */
export function paymentsActive(): boolean {
  return arePaymentsActive(isMainnet(), mainnetPaymentsEnabled());
}

export function hasRequiredConfig() {
  return Boolean(appConfig.contractId && appConfig.rpcUrl);
}
