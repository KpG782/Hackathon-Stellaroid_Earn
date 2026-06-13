/**
 * Passkey wallet server pieces (server-only — APAC spec §4 and Working
 * Agreement rule 4: relayer/indexer secrets never reach the client).
 *
 * Submits the graduate's signed wallet-deploy transaction through the
 * configured OpenZeppelin Relayer (passkey-kit@0.12's fee-sponsorship path),
 * so the graduate onboards with zero XLM. Network-agnostic: the relayer URL,
 * key, and RPC all come from env, so one code path serves testnet and mainnet
 * — the maintainer sets the network's values in Vercel; nothing is committed.
 */
import { appConfig } from "./config.ts";

if (typeof window !== "undefined") {
  throw new Error(
    "passkey-server is server-only and must not be imported in a client bundle",
  );
}

export interface PasskeyServerConfig {
  rpcUrl: string;
  relayerUrl: string;
  relayerApiKey: string;
  /** "channels" for a self-hosted OZ Relayer; omit for the managed service. */
  relayerPluginId?: string;
}

/** Server config for the relayer, or null when no relayer is provisioned. */
export function getPasskeyServerConfig(): PasskeyServerConfig | null {
  const relayerUrl = process.env.PASSKEY_RELAYER_URL?.trim();
  const relayerApiKey = process.env.PASSKEY_RELAYER_API_KEY?.trim();
  if (!relayerUrl || !relayerApiKey) return null;
  return {
    rpcUrl: appConfig.rpcUrl,
    relayerUrl,
    relayerApiKey,
    relayerPluginId: process.env.PASSKEY_RELAYER_PLUGIN_ID?.trim() || undefined,
  };
}

/** True iff a relayer is provisioned to submit fee-sponsored wallet deploys. */
export function passkeyRelayerConfigured(): boolean {
  return getPasskeyServerConfig() !== null;
}

export interface DeploySubmitResult {
  hash: string | null;
  transactionId: string | null;
  status: string | null;
}

/** The slice of the relayer client the submit path needs — the test seam. */
export interface TxSender {
  send(xdr: string): Promise<{
    hash?: string | null;
    transactionId?: string | null;
    status?: string | null;
  }>;
}

const XDR_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** Cheap shape gate before handing untrusted input to the relayer. */
export function isLikelyTransactionXdr(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 100 &&
    value.length <= 64_000 &&
    value.length % 4 === 0 &&
    XDR_RE.test(value)
  );
}

/**
 * Submits a signed wallet-deploy transaction XDR via the relayer. `sender` is
 * injected in tests; in production it defaults to the real PasskeyServer.
 */
export async function submitDeployTransaction(
  xdr: string,
  sender?: TxSender,
): Promise<DeploySubmitResult> {
  const tx = sender ?? (await loadPasskeyServer());
  const result = await tx.send(xdr);
  return {
    hash: result.hash ?? null,
    transactionId: result.transactionId ?? null,
    status: result.status ?? null,
  };
}

async function loadPasskeyServer(): Promise<TxSender> {
  const config = getPasskeyServerConfig();
  if (!config) {
    throw new Error("Passkey relayer is not configured for this deployment.");
  }
  // Submit through the OZ Relayer's Channels client directly — the same path
  // passkey-kit's PasskeyServer.send takes, but without loading the browser
  // half of passkey-kit (PasskeyKit + stellar-sdk/minimal) on the server.
  const { ChannelsClient } = await import("@openzeppelin/relayer-plugin-channels");
  const client = new ChannelsClient({
    baseUrl: config.relayerUrl,
    apiKey: config.relayerApiKey,
    ...(config.relayerPluginId ? { pluginId: config.relayerPluginId } : {}),
  });
  return {
    send: async (xdr) => {
      const res = await client.submitTransaction({ xdr });
      return {
        hash: res.hash,
        transactionId: res.transactionId,
        status: res.status,
      };
    },
  };
}
