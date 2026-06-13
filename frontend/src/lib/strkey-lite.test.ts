import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import {
  ed25519PublicKeyFromAddress,
  isValidContractAddress,
  isValidEd25519PublicKey,
} from "./strkey-lite.ts";

const KNOWN_ADDRESS = "GAWIOVGFSPJDEIJJZUSVRFPVP3D5VNO2LGCU47KEHJD6MV277QKNR34D";
const KNOWN_CONTRACT = "CDMUOHMARNVOJZM3IVOCJUPGBHDTHFBMZCCZXEZPQDVJGILH3NIKTTW3";

test("decodes a known G-address to the same bytes as the SDK StrKey", () => {
  const lite = ed25519PublicKeyFromAddress(KNOWN_ADDRESS);
  const sdk = StrKey.decodeEd25519PublicKey(KNOWN_ADDRESS);

  assert.equal(lite.length, 32);
  assert.deepEqual([...lite], [...sdk]);
});

test("cross-validates against random SDK keypairs", () => {
  for (let i = 0; i < 8; i += 1) {
    const keypair = Keypair.random();
    const lite = ed25519PublicKeyFromAddress(keypair.publicKey());
    assert.deepEqual([...lite], [...keypair.rawPublicKey()]);
  }
});

test("rejects checksum corruption", () => {
  // Swap the final character for a different alphabet character so the
  // CRC16-XModem trailer no longer matches.
  const last = KNOWN_ADDRESS.at(-1);
  const corruptedChar = last === "A" ? "B" : "A";
  const corrupted = KNOWN_ADDRESS.slice(0, -1) + corruptedChar;

  assert.throws(() => ed25519PublicKeyFromAddress(corrupted), /checksum/);
});

test("rejects non-G version bytes (contract and seed strkeys)", () => {
  // C-address (contract) and S-seed are valid strkeys with other version bytes.
  const contract =
    "CDMUOHMARNVOJZM3IVOCJUPGBHDTHFBMZCCZXEZPQDVJGILH3NIKTTW3";
  assert.throws(() => ed25519PublicKeyFromAddress(contract), /version/);

  const seed = Keypair.random().secret();
  assert.throws(() => ed25519PublicKeyFromAddress(seed), /version/);
});

test("rejects malformed input", () => {
  assert.throws(() => ed25519PublicKeyFromAddress(""), /56 characters/);
  assert.throws(
    () => ed25519PublicKeyFromAddress(KNOWN_ADDRESS.slice(0, 55)),
    /56 characters/,
  );
  assert.throws(
    () => ed25519PublicKeyFromAddress(`${KNOWN_ADDRESS}A`),
    /56 characters/,
  );
  // Lowercase and out-of-alphabet characters are invalid base32.
  assert.throws(
    () => ed25519PublicKeyFromAddress(KNOWN_ADDRESS.toLowerCase()),
    /base32/,
  );
  assert.throws(
    () => ed25519PublicKeyFromAddress(`1${KNOWN_ADDRESS.slice(1)}`),
    /base32/,
  );
});

test("isValidEd25519PublicKey accepts G-addresses and nothing else", () => {
  assert.equal(isValidEd25519PublicKey(KNOWN_ADDRESS), true);
  for (let i = 0; i < 8; i += 1) {
    assert.equal(isValidEd25519PublicKey(Keypair.random().publicKey()), true);
  }
  // A contract address, a seed, a checksum-corrupted G, and junk are rejected.
  assert.equal(isValidEd25519PublicKey(KNOWN_CONTRACT), false);
  assert.equal(isValidEd25519PublicKey(Keypair.random().secret()), false);
  const corrupted =
    KNOWN_ADDRESS.slice(0, -1) + (KNOWN_ADDRESS.at(-1) === "A" ? "B" : "A");
  assert.equal(isValidEd25519PublicKey(corrupted), false);
  assert.equal(isValidEd25519PublicKey(""), false);
  assert.equal(isValidEd25519PublicKey(KNOWN_ADDRESS.toLowerCase()), false);
});

test("isValidContractAddress accepts C-addresses and nothing else", () => {
  assert.equal(isValidContractAddress(KNOWN_CONTRACT), true);
  for (let i = 0; i < 8; i += 1) {
    const contract = StrKey.encodeContract(Keypair.random().rawPublicKey());
    assert.equal(isValidContractAddress(contract), true);
  }
  // A G-address, a checksum-corrupted C, and junk are rejected.
  assert.equal(isValidContractAddress(KNOWN_ADDRESS), false);
  const corrupted =
    KNOWN_CONTRACT.slice(0, -1) + (KNOWN_CONTRACT.at(-1) === "A" ? "B" : "A");
  assert.equal(isValidContractAddress(corrupted), false);
  assert.equal(isValidContractAddress(""), false);
  assert.equal(isValidContractAddress(KNOWN_CONTRACT.toLowerCase()), false);
});
