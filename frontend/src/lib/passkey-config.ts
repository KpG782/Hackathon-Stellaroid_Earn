/**
 * Passkey smart-wallet configuration (APAC spec §4, Pillar 2).
 *
 * Client-safe and network-agnostic: every value comes from env, so the same
 * code serves testnet and mainnet — the maintainer provisions a wallet-factory
 * WASM hash + relayer for the deployment's network and flips the env (mirrors
 * how the rest of the app switches networks). Nothing network-specific is
 * committed. Server-only relayer/indexer secrets live in `passkey/server.ts`.
 *
 * Passkeys are OFF unless a wallet WASM hash is configured, so graduates fall
 * back to the shipped Freighter flow until the factory is deployed.
 */
import { appConfig, getExpectedNetworkPassphrase } from "./config.ts";

const WASM_HASH_RE = /^[0-9a-f]{64}$/;

export interface PasskeyClientConfig {
  rpcUrl: string;
  networkPassphrase: string;
  /** 32-byte hex hash of the deployed smart-wallet contract WASM (per network). */
  walletWasmHash: string;
}

/** The deployed wallet-factory WASM hash for this network, or "" if unset/invalid. */
export function getWalletWasmHash(): string {
  const raw = process.env.NEXT_PUBLIC_PASSKEY_WALLET_WASM_HASH?.trim().toLowerCase() ?? "";
  return WASM_HASH_RE.test(raw) ? raw : "";
}

/**
 * True when graduates can use passkey wallets: a wallet WASM hash is
 * provisioned and the feature isn't explicitly disabled. When false, the UI
 * keeps the Freighter flow.
 */
export function passkeysEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ENABLE_PASSKEYS === "false") return false;
  return getWalletWasmHash() !== "";
}

/** Client config for PasskeyKit, or null when passkeys aren't provisioned. */
export function getPasskeyClientConfig(): PasskeyClientConfig | null {
  const walletWasmHash = getWalletWasmHash();
  if (!walletWasmHash || !passkeysEnabled()) return null;
  return {
    rpcUrl: appConfig.rpcUrl,
    networkPassphrase: getExpectedNetworkPassphrase(),
    walletWasmHash,
  };
}
