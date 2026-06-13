import assert from "node:assert/strict";
import test from "node:test";
import {
  arePaymentsActive,
  getUsdcIssuer,
  isMainnet,
  mainnetPaymentsEnabled,
  paymentsActive,
} from "./config.ts";
import { isValidEd25519PublicKey } from "./strkey-lite.ts";

test("arePaymentsActive: testnet always active; mainnet needs the opt-in", () => {
  // Testnet — always active regardless of the switch.
  assert.equal(arePaymentsActive(false, false), true);
  assert.equal(arePaymentsActive(false, true), true);
  // Mainnet — paused unless explicitly enabled.
  assert.equal(arePaymentsActive(true, false), false);
  assert.equal(arePaymentsActive(true, true), true);
});

test("mainnetPaymentsEnabled reads the server kill switch", () => {
  const previous = process.env.ENABLE_MAINNET_PAYMENTS;
  try {
    delete process.env.ENABLE_MAINNET_PAYMENTS;
    assert.equal(mainnetPaymentsEnabled(), false);
    process.env.ENABLE_MAINNET_PAYMENTS = "false";
    assert.equal(mainnetPaymentsEnabled(), false);
    process.env.ENABLE_MAINNET_PAYMENTS = "true";
    assert.equal(mainnetPaymentsEnabled(), true);
  } finally {
    if (previous === undefined) delete process.env.ENABLE_MAINNET_PAYMENTS;
    else process.env.ENABLE_MAINNET_PAYMENTS = previous;
  }
});

test("CI default network is testnet, so payouts are active", () => {
  // The test env carries no NEXT_PUBLIC_STELLAR_NETWORK → TESTNET.
  assert.equal(isMainnet(), false);
  assert.equal(paymentsActive(), true);
});

test("getUsdcIssuer returns a valid issuer account for the active network", () => {
  assert.equal(isValidEd25519PublicKey(getUsdcIssuer()), true);
});
