import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import {
  classifyRecipient,
  isValidRecipientAddress,
} from "./recipient-address.ts";

const G_ADDRESS = "GAWIOVGFSPJDEIJJZUSVRFPVP3D5VNO2LGCU47KEHJD6MV277QKNR34D";
const C_ADDRESS = "CDMUOHMARNVOJZM3IVOCJUPGBHDTHFBMZCCZXEZPQDVJGILH3NIKTTW3";

test("classifies classic accounts as ed25519", () => {
  assert.equal(classifyRecipient(G_ADDRESS), "ed25519");
  assert.equal(classifyRecipient(Keypair.random().publicKey()), "ed25519");
});

test("classifies smart-wallet contracts as contract", () => {
  assert.equal(classifyRecipient(C_ADDRESS), "contract");
  const minted = StrKey.encodeContract(Keypair.random().rawPublicKey());
  assert.equal(classifyRecipient(minted), "contract");
});

test("returns null for anything that is neither a valid G nor C address", () => {
  for (const bad of [
    "",
    "not-an-address",
    "GSHORT",
    Keypair.random().secret(), // S-seed: valid strkey, wrong version byte
    G_ADDRESS.toLowerCase(),
    G_ADDRESS.slice(0, -1) + (G_ADDRESS.at(-1) === "A" ? "B" : "A"), // bad CRC
  ]) {
    assert.equal(classifyRecipient(bad), null, `address: ${bad}`);
    assert.equal(isValidRecipientAddress(bad), false, `address: ${bad}`);
  }
});

test("isValidRecipientAddress accepts both recipient kinds", () => {
  assert.equal(isValidRecipientAddress(G_ADDRESS), true);
  assert.equal(isValidRecipientAddress(C_ADDRESS), true);
});
