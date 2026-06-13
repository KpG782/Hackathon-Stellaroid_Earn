import assert from "node:assert/strict";
import test from "node:test";
import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import {
  decodeTransferEvent,
  detectSacPayout,
  findSacTransfer,
  sacContractIdForAsset,
  stroopsToDisplay,
  type DecodedTransfer,
  type EventsServer,
  type SacEvent,
} from "./sac-events.ts";
import { isValidContractAddress } from "./strkey-lite.ts";
import type { PayoutIntent } from "./payout-intent.ts";

const CONTRACT = "CDMUOHMARNVOJZM3IVOCJUPGBHDTHFBMZCCZXEZPQDVJGILH3NIKTTW3";
const FROM = "GAWIOVGFSPJDEIJJZUSVRFPVP3D5VNO2LGCU47KEHJD6MV277QKNR34D";
const OTHER_CONTRACT = "CA7P5EPYKC2IW4PCMAH6NRBLHH3WP7AN6WWC3QDRWO4HLE47FAGO6TET";

const INTENT: PayoutIntent = {
  credentialHash:
    "c02ce1602d5bbb6ddfe93c6603d7f4e3dae3b2fb571ea4e70669ccd5a359aea3",
  recipientAddress: CONTRACT,
  amountXlm: "25.0000000",
  asset: "USDC",
  createdAt: "2026-06-12T08:00:00.000Z",
};

function transferEvent(opts: {
  to: string;
  from?: string;
  amount: bigint;
  symbol?: string;
  asset?: string;
  closedAt?: string;
  txHash?: string;
  success?: boolean;
}): SacEvent {
  const topic = [
    xdr.ScVal.scvSymbol(opts.symbol ?? "transfer"),
    Address.fromString(opts.from ?? FROM).toScVal(),
    Address.fromString(opts.to).toScVal(),
  ];
  if (opts.asset) topic.push(nativeToScVal(opts.asset, { type: "string" }));
  return {
    topic,
    value: nativeToScVal(opts.amount, { type: "i128" }),
    ledgerClosedAt: opts.closedAt ?? "2026-06-12T08:05:00.000Z",
    txHash: opts.txHash ?? "ab".repeat(32),
    inSuccessfulContractCall: opts.success ?? true,
  };
}

test("decodes a 3-topic SAC transfer event", () => {
  const decoded = decodeTransferEvent(
    transferEvent({ to: CONTRACT, amount: 250_000_000n, txHash: "feed" }),
  );
  assert.ok(decoded);
  assert.equal(decoded.to, CONTRACT);
  assert.equal(decoded.amountStroops, 250_000_000n);
  assert.equal(decoded.txHash, "feed");
});

test("decodes the 4-topic (asset-tagged) transfer shape too", () => {
  const decoded = decodeTransferEvent(
    transferEvent({ to: CONTRACT, amount: 250_000_000n, asset: "USDC:GISSUER" }),
  );
  assert.ok(decoded);
  assert.equal(decoded.to, CONTRACT);
});

test("rejects non-transfer, failed-call, and malformed events", () => {
  assert.equal(
    decodeTransferEvent(transferEvent({ to: CONTRACT, amount: 1n, symbol: "mint" })),
    null,
  );
  assert.equal(
    decodeTransferEvent(transferEvent({ to: CONTRACT, amount: 1n, success: false })),
    null,
  );
  // Fewer than 3 topics (no `to`).
  assert.equal(
    decodeTransferEvent({
      topic: [xdr.ScVal.scvSymbol("transfer"), Address.fromString(FROM).toScVal()],
      value: nativeToScVal(1n, { type: "i128" }),
      ledgerClosedAt: "2026-06-12T08:05:00.000Z",
      txHash: "x",
      inSuccessfulContractCall: true,
    }),
    null,
  );
});

test("findSacTransfer applies recipient, time, and amount rules", () => {
  const base: DecodedTransfer = {
    to: CONTRACT,
    amountStroops: 250_000_000n,
    closedAt: "2026-06-12T08:05:00.000Z",
    txHash: "ok",
  };
  assert.equal(findSacTransfer([base], INTENT)?.txHash, "ok");
  assert.equal(findSacTransfer([{ ...base, to: OTHER_CONTRACT }], INTENT), null);
  assert.equal(
    findSacTransfer([{ ...base, closedAt: "2026-06-12T07:59:00.000Z" }], INTENT),
    null,
  );
  assert.equal(
    findSacTransfer([{ ...base, amountStroops: 240_000_000n }], INTENT),
    null,
  );
  assert.ok(findSacTransfer([{ ...base, amountStroops: 999_000_000n }], INTENT));
});

test("sacContractIdForAsset returns a valid contract address per asset", () => {
  assert.equal(isValidContractAddress(sacContractIdForAsset("USDC")), true);
  assert.equal(isValidContractAddress(sacContractIdForAsset("XLM")), true);
  assert.notEqual(sacContractIdForAsset("USDC"), sacContractIdForAsset("XLM"));
});

test("stroopsToDisplay formats 7-decimal amounts", () => {
  assert.equal(stroopsToDisplay(250_000_000n), "25.0000000");
  assert.equal(stroopsToDisplay(1n), "0.0000001");
  assert.equal(stroopsToDisplay(0n), "0.0000000");
});

test("detectSacPayout queries the SAC and returns the matched payment", async () => {
  let queriedContract: string | undefined;
  const server: EventsServer = {
    getLatestLedger: async () => ({ sequence: 1000 }),
    getEvents: async (request) => {
      queriedContract = request.filters[0]?.contractIds?.[0];
      assert.ok(request.startLedger && request.startLedger >= 1);
      return {
        events: [
          transferEvent({ to: CONTRACT, amount: 250_000_000n, txHash: "deadbeef" }),
        ],
      };
    },
  };

  const result = await detectSacPayout(INTENT, { server });
  assert.deepEqual(result, { amount: "25.0000000", transactionHash: "deadbeef" });
  assert.equal(queriedContract, sacContractIdForAsset("USDC"));
});

test("detectSacPayout returns null when no event satisfies the intent", async () => {
  const server: EventsServer = {
    getLatestLedger: async () => ({ sequence: 1000 }),
    getEvents: async () => ({
      events: [transferEvent({ to: CONTRACT, amount: 10_000_000n })], // underpay
    }),
  };
  assert.equal(await detectSacPayout(INTENT, { server }), null);
});
