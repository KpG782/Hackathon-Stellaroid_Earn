import assert from "node:assert/strict";
import test from "node:test";
import {
  COINGECKO_ID,
  isPayoutAsset,
  normalizePayoutAsset,
  PAYOUT_ASSETS,
} from "./payout-asset.ts";

test("isPayoutAsset accepts XLM and USDC only", () => {
  assert.equal(isPayoutAsset("XLM"), true);
  assert.equal(isPayoutAsset("USDC"), true);
  for (const bad of ["BTC", "usdc", "", null, undefined, 1]) {
    assert.equal(isPayoutAsset(bad), false, `value: ${String(bad)}`);
  }
});

test("normalizePayoutAsset coerces legacy/unknown values to XLM", () => {
  assert.equal(normalizePayoutAsset("USDC"), "USDC");
  assert.equal(normalizePayoutAsset("XLM"), "XLM");
  assert.equal(normalizePayoutAsset(undefined), "XLM");
  assert.equal(normalizePayoutAsset("BTC"), "XLM");
});

test("USDC is the default (first) selectable asset", () => {
  assert.equal(PAYOUT_ASSETS[0], "USDC");
  assert.deepEqual([...PAYOUT_ASSETS].sort(), ["USDC", "XLM"]);
});

test("each asset maps to a CoinGecko id", () => {
  assert.equal(COINGECKO_ID.XLM, "stellar");
  assert.equal(COINGECKO_ID.USDC, "usd-coin");
});
