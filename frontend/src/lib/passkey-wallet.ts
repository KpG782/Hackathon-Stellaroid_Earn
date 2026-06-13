/**
 * Graduate passkey smart-wallet orchestration (APAC spec §4, Pillar 2).
 *
 * A graduate creates a Soroban smart wallet with a fingerprint / Face ID — no
 * seed phrase, no extension, no XLM. The wallet's contract address (C-address)
 * becomes their payout recipient, which the payout loop already accepts
 * (see recipient-address.ts). Employers/issuers keep the Freighter flow.
 *
 * Bundle isolation (P1-3 invariant): `passkey-kit` (and its nested
 * stellar-sdk) is pulled in ONLY through the dynamic import in
 * `loadPasskeyKit`, so importing this module costs zero wallet bytes and the
 * heavy library lands only in the chunk for the route that actually creates a
 * wallet. The orchestration functions take the kit as a parameter so they are
 * unit-testable without loading the library or a real authenticator.
 */
import { getPasskeyClientConfig } from "./passkey-config.ts";
import { isValidContractAddress } from "./strkey-lite.ts";

/** The subset of PasskeyKit this app uses — the seam for tests and the loader. */
export interface GraduateWalletKit {
  createWallet(
    app: string,
    user: string,
  ): Promise<{
    contractId: string;
    keyIdBase64: string;
    signedTx: { toXDR(): string };
  }>;
  connectWallet(opts?: {
    keyId?: string;
  }): Promise<{ contractId: string; keyIdBase64: string }>;
}

export interface CreatedGraduateWallet {
  /** Smart-wallet contract address (C). The payout recipient. */
  contractAddress: string;
  /** Passkey credential id (base64url) — persist to reconnect on this device. */
  keyIdBase64: string;
  /** Signed deploy transaction XDR — submit via /api/passkey/deploy (relayer). */
  signedTxXdr: string;
}

function assertContractAddress(contractId: string): string {
  if (!isValidContractAddress(contractId)) {
    throw new Error(
      "passkey wallet returned an address that is not a valid Soroban contract",
    );
  }
  return contractId;
}

/**
 * Creates a passkey wallet. Triggers the WebAuthn registration ceremony and
 * builds the (relayer-submittable) deploy transaction. The returned
 * `signedTxXdr` must be submitted server-side so the graduate pays no fees.
 */
export async function createGraduateWallet(
  kit: GraduateWalletKit,
  opts: { appName: string; userName: string },
): Promise<CreatedGraduateWallet> {
  const { contractId, keyIdBase64, signedTx } = await kit.createWallet(
    opts.appName,
    opts.userName,
  );
  return {
    contractAddress: assertContractAddress(contractId),
    keyIdBase64,
    signedTxXdr: signedTx.toXDR(),
  };
}

/** Reconnects an existing passkey wallet (WebAuthn authentication ceremony). */
export async function connectGraduateWallet(
  kit: GraduateWalletKit,
  opts: { keyId?: string } = {},
): Promise<{ contractAddress: string; keyIdBase64: string }> {
  const { contractId, keyIdBase64 } = await kit.connectWallet(
    opts.keyId ? { keyId: opts.keyId } : {},
  );
  return { contractAddress: assertContractAddress(contractId), keyIdBase64 };
}

/**
 * Builds a real PasskeyKit from the deployment's network config. The dynamic
 * import is the ONLY reference to `passkey-kit` in the app — keep it that way.
 * Throws when passkeys aren't provisioned (callers should check
 * `passkeysEnabled()` first and offer Freighter instead).
 */
export async function loadPasskeyKit(): Promise<GraduateWalletKit> {
  const config = getPasskeyClientConfig();
  if (!config) {
    throw new Error("Passkey wallets are not configured for this deployment.");
  }
  const { PasskeyKit } = await import("passkey-kit");
  const kit = new PasskeyKit({
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    walletWasmHash: config.walletWasmHash,
  });
  // Structural adapter: PasskeyKit is a superset of GraduateWalletKit.
  return kit as unknown as GraduateWalletKit;
}
