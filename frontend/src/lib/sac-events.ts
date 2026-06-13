/**
 * SAC transfer-event payment detection (APAC spec §5; Week 4 Phase B). Closes
 * the passkey payout loop: a payment to a smart-wallet contract (C-address)
 * goes through the Stellar Asset Contract `transfer`, which is a Soroban
 * contract event — NOT a classic Horizon payment — so the classic matcher in
 * payment-detect.ts cannot see it. This queries the asset's SAC via Soroban RPC
 * `getEvents`, decodes the transfer, and matches it to the intent.
 *
 * Server-only (Soroban RPC + stellar-sdk). The decode and match logic are split
 * out so they are unit-testable without a network, and the RPC is injected.
 */
import { Address, Asset, rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import {
  appConfig,
  getExpectedNetworkPassphrase,
  getUsdcIssuer,
} from "./config.ts";
import { toStroops, type DetectedPayment } from "./payment-detect.ts";
import type { PayoutAsset } from "./payout-asset.ts";
import type { PayoutIntent } from "./payout-intent.ts";

if (typeof window !== "undefined") {
  throw new Error(
    "sac-events is server-only and must not be imported in a client bundle",
  );
}

const TRANSFER_SYMBOL = "transfer";
// ~24h at 5s/ledger — comfortably inside the RPC event-retention window.
const DEFAULT_LOOKBACK_LEDGERS = 17_280;
const EVENT_PAGE_LIMIT = 200;

/** The Stellar Asset Contract (C-address) for the intent's asset on this network. */
export function sacContractIdForAsset(asset: PayoutAsset): string {
  const sdkAsset =
    asset === "USDC" ? new Asset("USDC", getUsdcIssuer()) : Asset.native();
  return sdkAsset.contractId(getExpectedNetworkPassphrase());
}

export type DecodedTransfer = {
  to: string;
  amountStroops: bigint;
  closedAt: string;
  txHash: string;
};

/** The fields of a Soroban RPC event this detector reads (a subset of the SDK type). */
export type SacEvent = {
  topic: xdr.ScVal[];
  value: xdr.ScVal;
  ledgerClosedAt: string;
  txHash: string;
  inSuccessfulContractCall: boolean;
};

/**
 * Decodes a SAC `transfer` event into { to, amount }. The SAC emits topics
 * [Symbol "transfer", from: Address, to: Address (, asset: String)] with the
 * i128 amount as the event value. Returns null for anything else: a failed
 * contract call, a non-transfer event, or a shape we can't read.
 */
export function decodeTransferEvent(event: SacEvent): DecodedTransfer | null {
  if (!event.inSuccessfulContractCall) return null;
  const topics = event.topic;
  if (!Array.isArray(topics) || topics.length < 3) return null;
  try {
    if (scValToNative(topics[0]) !== TRANSFER_SYMBOL) return null;
    const to = scValToNative(topics[2]);
    if (typeof to !== "string") return null;
    const amount = scValToNative(event.value);
    if (typeof amount !== "bigint" || amount <= 0n) return null;
    return {
      to,
      amountStroops: amount,
      closedAt: event.ledgerClosedAt,
      txHash: event.txHash,
    };
  } catch {
    return null;
  }
}

/**
 * First decoded transfer that satisfies the intent: to the recipient, newer
 * than the intent, for at least the intent amount. Pure — unit-testable.
 */
export function findSacTransfer(
  transfers: DecodedTransfer[],
  intent: PayoutIntent,
): DecodedTransfer | null {
  const required = toStroops(intent.amountXlm);
  const notBefore = Date.parse(intent.createdAt);
  for (const transfer of transfers) {
    if (transfer.to !== intent.recipientAddress) continue;
    if (Date.parse(transfer.closedAt) <= notBefore) continue;
    if (transfer.amountStroops < required) continue;
    return transfer;
  }
  return null;
}

/** stroops (7-decimal integer) → display string ("250.0000000"). */
export function stroopsToDisplay(stroops: bigint): string {
  const whole = stroops / 10_000_000n;
  const fraction = (stroops % 10_000_000n).toString().padStart(7, "0");
  return `${whole}.${fraction}`;
}

/** Topic filters narrowing the query to `transfer` events for this recipient. */
function topicFilters(recipient: string): string[][] {
  const transfer = xdr.ScVal.scvSymbol(TRANSFER_SYMBOL).toXDR("base64");
  const to = Address.fromString(recipient).toScVal().toXDR("base64");
  // Match both the 3-topic (from, to) and 4-topic (from, to, asset) shapes the
  // SAC has emitted across protocol versions. "*" is the segment wildcard.
  return [
    [transfer, "*", to],
    [transfer, "*", to, "*"],
  ];
}

/** The slice of Soroban RPC the detector needs — the seam for tests. */
export interface EventsServer {
  getLatestLedger(): Promise<{ sequence: number }>;
  getEvents(request: {
    filters: Array<{
      type?: "contract";
      contractIds?: string[];
      topics?: string[][];
    }>;
    startLedger?: number;
    limit?: number;
  }): Promise<{ events: SacEvent[] }>;
}

export interface DetectSacDeps {
  server?: EventsServer;
  lookbackLedgers?: number;
}

function defaultServer(): EventsServer {
  const server = new rpc.Server(appConfig.rpcUrl, {
    allowHttp: appConfig.rpcUrl.startsWith("http://"),
  });
  return {
    getLatestLedger: () => server.getLatestLedger(),
    getEvents: (request) =>
      server.getEvents(
        request as Parameters<typeof server.getEvents>[0],
      ) as Promise<{ events: SacEvent[] }>,
  };
}

/**
 * Detects a SAC payment that satisfies a contract-recipient intent. Returns the
 * normalized DetectedPayment or null (still awaiting). Never throws past the
 * caller's try/catch — a degraded result is "awaiting", not an error.
 */
export async function detectSacPayout(
  intent: PayoutIntent,
  deps: DetectSacDeps = {},
): Promise<DetectedPayment | null> {
  const server = deps.server ?? defaultServer();
  const lookback = deps.lookbackLedgers ?? DEFAULT_LOOKBACK_LEDGERS;

  const latest = await server.getLatestLedger();
  const startLedger = Math.max(1, latest.sequence - lookback);

  const { events } = await server.getEvents({
    startLedger,
    limit: EVENT_PAGE_LIMIT,
    filters: [
      {
        type: "contract",
        contractIds: [sacContractIdForAsset(intent.asset)],
        topics: topicFilters(intent.recipientAddress),
      },
    ],
  });

  const transfers = events
    .map(decodeTransferEvent)
    .filter((transfer): transfer is DecodedTransfer => transfer !== null);

  const match = findSacTransfer(transfers, intent);
  if (!match) return null;
  return {
    amount: stroopsToDisplay(match.amountStroops),
    transactionHash: match.txHash,
  };
}
