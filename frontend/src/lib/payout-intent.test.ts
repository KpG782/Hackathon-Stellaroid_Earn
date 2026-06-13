import assert from "node:assert/strict";
import test from "node:test";
import {
  decodePayoutIntent,
  encodePayoutIntent,
  signPayloadForTests,
  type PayoutIntent,
} from "./payout-intent.ts";

const SECRET = "test_intent_secret";
const VALID: PayoutIntent = {
  credentialHash:
    "c02ce1602d5bbb6ddfe93c6603d7f4e3dae3b2fb571ea4e70669ccd5a359aea3",
  recipientAddress: "GBS7TPSDSRSG57VGSRUGGHBSHIQVO4VPJBDPG2XLYTXN5FBGYVFXKFDN",
  amountXlm: "25.0000000",
  asset: "XLM",
  createdAt: "2026-06-12T08:00:00.000Z",
};

test("round-trips a valid intent", () => {
  const token = encodePayoutIntent(VALID, SECRET);
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, "base64url payload.signature");
  assert.deepEqual(decodePayoutIntent(token, SECRET), VALID);
});

test("accepts a smart-wallet contract (C-address) recipient", () => {
  // Passkey graduate wallets are Soroban contract accounts (APAC spec §4).
  const intent: PayoutIntent = {
    ...VALID,
    recipientAddress: "CDMUOHMARNVOJZM3IVOCJUPGBHDTHFBMZCCZXEZPQDVJGILH3NIKTTW3",
  };
  const token = encodePayoutIntent(intent, SECRET);
  assert.deepEqual(decodePayoutIntent(token, SECRET), intent);
});

test("rejects a recipient with a corrupted checksum (G or C)", () => {
  const badG = VALID.recipientAddress.slice(0, -1) +
    (VALID.recipientAddress.at(-1) === "A" ? "B" : "A");
  assert.throws(() => encodePayoutIntent({ ...VALID, recipientAddress: badG }, SECRET));

  const contract = "CDMUOHMARNVOJZM3IVOCJUPGBHDTHFBMZCCZXEZPQDVJGILH3NIKTTW3";
  const badC = contract.slice(0, -1) + (contract.at(-1) === "A" ? "B" : "A");
  assert.throws(() => encodePayoutIntent({ ...VALID, recipientAddress: badC }, SECRET));
});

test("rejects a tampered payload", () => {
  const token = encodePayoutIntent(VALID, SECRET);
  const [, signature] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({ ...VALID, amountXlm: "9999.0000000" }),
  ).toString("base64url");
  assert.equal(decodePayoutIntent(`${forged}.${signature}`, SECRET), null);
});

test("rejects a token signed with the wrong secret", () => {
  const token = encodePayoutIntent(VALID, "other_secret");
  assert.equal(decodePayoutIntent(token, SECRET), null);
});

test("malformed tokens return null instead of throwing", () => {
  for (const bad of ["", "abc", "a.b.c", "!!!.???", "a.", ".b"]) {
    assert.equal(decodePayoutIntent(bad, SECRET), null, `token: ${bad}`);
  }
});

test("encode validates the payload shape", () => {
  assert.throws(() =>
    encodePayoutIntent({ ...VALID, credentialHash: "nope" }, SECRET),
  );
  assert.throws(() =>
    encodePayoutIntent({ ...VALID, recipientAddress: "not-an-address" }, SECRET),
  );
  assert.throws(() =>
    encodePayoutIntent({ ...VALID, amountXlm: "-5.0000000" }, SECRET),
  );
  assert.throws(() =>
    encodePayoutIntent({ ...VALID, amountXlm: "25" }, SECRET),
  );
  assert.throws(() =>
    encodePayoutIntent({ ...VALID, createdAt: "yesterday" }, SECRET),
  );
});

test("decode revalidates shape even when the signature matches", () => {
  const bad = { ...VALID, recipientAddress: "GSHORT" };
  // Bypass encode validation by signing the bad payload manually.
  const json = JSON.stringify(bad);
  const payload = Buffer.from(json).toString("base64url");
  const token = `${payload}.${signPayloadForTests(json, SECRET)}`;
  assert.equal(decodePayoutIntent(token, SECRET), null);
});

test("round-trips a USDC intent", () => {
  const intent: PayoutIntent = { ...VALID, asset: "USDC" };
  const token = encodePayoutIntent(intent, SECRET);
  assert.deepEqual(decodePayoutIntent(token, SECRET), intent);
});

test("a legacy token without an asset field decodes as XLM", () => {
  // Sign a payload that predates the asset field — must still verify.
  const { asset: _omit, ...legacy } = VALID;
  void _omit;
  const json = JSON.stringify(legacy);
  const payload = Buffer.from(json).toString("base64url");
  const token = `${payload}.${signPayloadForTests(json, SECRET)}`;
  assert.deepEqual(decodePayoutIntent(token, SECRET), { ...legacy, asset: "XLM" });
});

test("a token with an unsupported asset is rejected", () => {
  const json = JSON.stringify({ ...VALID, asset: "BTC" });
  const payload = Buffer.from(json).toString("base64url");
  const token = `${payload}.${signPayloadForTests(json, SECRET)}`;
  assert.equal(decodePayoutIntent(token, SECRET), null);
});
