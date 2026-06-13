import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { keygenAsync, signAsync } from "@noble/ed25519";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import {
  canonicalCredentialBytes,
  sep43Digest,
  verifyCredentialSignature,
} from "./credential-sign.ts";

const FIXTURE: Record<string, unknown> = {
  type: ["StellaroidSignableCredential", "AchievementSubject"],
  identifier: [
    {
      type: "IdentityObject",
      identityHash: "a".repeat(64),
      identityType: "identifier",
      hashed: true,
      salt: "not-salted",
    },
  ],
  achievement: {
    type: ["Achievement"],
    name: "Stellar Smart Contract Bootcamp Completion",
    description: "Awarded after shipping a working Soroban contract.",
    criteria: { narrative: "Deploy to testnet." },
    tag: ["Soroban smart contracts", "Stellar testnet deployment"],
  },
};

async function signedFixture() {
  const { secretKey, publicKey } = await keygenAsync();
  const issuerAddress = StrKey.encodeEd25519PublicKey(Buffer.from(publicKey));
  const digest = await sep43Digest(canonicalCredentialBytes(FIXTURE));
  const signature = await signAsync(digest, secretKey);
  return {
    issuerAddress,
    signatureBase64: Buffer.from(signature).toString("base64"),
  };
}

test("canonicalCredentialBytes is insertion-order independent", () => {
  const a = canonicalCredentialBytes({
    title: "Badge",
    nested: { z: 1, a: [{ b: 2, a: 1 }] },
    skills: ["one", "two"],
  });
  const b = canonicalCredentialBytes({
    nested: { a: [{ a: 1, b: 2 }], z: 1 },
    skills: ["one", "two"],
    title: "Badge",
  });

  assert.deepEqual([...a], [...b]);
  assert.equal(
    new TextDecoder().decode(a),
    '{"nested":{"a":[{"a":1,"b":2}],"z":1},"skills":["one","two"],"title":"Badge"}',
  );
});

test("canonicalCredentialBytes preserves array order", () => {
  const ordered = canonicalCredentialBytes({ tag: ["b", "a"] });
  assert.equal(new TextDecoder().decode(ordered), '{"tag":["b","a"]}');
});

test("sep43Digest is SHA-256 over the Stellar Signed Message prefix + message", async () => {
  const message = new TextEncoder().encode("hello stellaroid");
  const digest = await sep43Digest(message);

  const expected = createHash("sha256")
    .update("Stellar Signed Message:\n", "utf8")
    .update(message)
    .digest();

  assert.equal(digest.length, 32);
  assert.deepEqual([...digest], [...expected]);
});

test("verifies a signature produced with the matching Stellar G-address", async () => {
  const { issuerAddress, signatureBase64 } = await signedFixture();

  const ok = await verifyCredentialSignature({
    credential: FIXTURE,
    signatureBase64,
    issuerAddress,
  });
  assert.equal(ok, true);

  // Key-order changes do not break verification (canonical serialization).
  const reordered = {
    achievement: FIXTURE.achievement,
    identifier: FIXTURE.identifier,
    type: FIXTURE.type,
  };
  assert.equal(
    await verifyCredentialSignature({
      credential: reordered,
      signatureBase64,
      issuerAddress,
    }),
    true,
  );
});

test("verifies a signature produced by a stellar-sdk Keypair over the digest", async () => {
  const keypair = Keypair.random();
  const digest = await sep43Digest(canonicalCredentialBytes(FIXTURE));
  const signatureBase64 = keypair.sign(Buffer.from(digest)).toString("base64");

  assert.equal(
    await verifyCredentialSignature({
      credential: FIXTURE,
      signatureBase64,
      issuerAddress: keypair.publicKey(),
    }),
    true,
  );
});

test("rejects a tampered credential", async () => {
  const { issuerAddress, signatureBase64 } = await signedFixture();
  const tampered = {
    ...FIXTURE,
    achievement: {
      ...(FIXTURE.achievement as Record<string, unknown>),
      name: "Forged Credential",
    },
  };

  assert.equal(
    await verifyCredentialSignature({
      credential: tampered,
      signatureBase64,
      issuerAddress,
    }),
    false,
  );
});

test("rejects the wrong issuer address", async () => {
  const { signatureBase64 } = await signedFixture();

  assert.equal(
    await verifyCredentialSignature({
      credential: FIXTURE,
      signatureBase64,
      issuerAddress: Keypair.random().publicKey(),
    }),
    false,
  );
});

test("returns false (never throws) on garbage input", async () => {
  const { issuerAddress, signatureBase64 } = await signedFixture();

  // Garbage base64 strings.
  for (const bad of ["", "!!!not-base64!!!", "abc", "QQ==", `${"A".repeat(85)}=`]) {
    assert.equal(
      await verifyCredentialSignature({
        credential: FIXTURE,
        signatureBase64: bad,
        issuerAddress,
      }),
      false,
    );
  }

  // Malformed issuer addresses.
  for (const bad of ["", "GABC", "not-an-address", issuerAddress.toLowerCase()]) {
    assert.equal(
      await verifyCredentialSignature({
        credential: FIXTURE,
        signatureBase64,
        issuerAddress: bad,
      }),
      false,
    );
  }

  // Unserializable credential (BigInt has no JSON representation).
  assert.equal(
    await verifyCredentialSignature({
      credential: { amount: 1n },
      signatureBase64,
      issuerAddress,
    }),
    false,
  );
});
