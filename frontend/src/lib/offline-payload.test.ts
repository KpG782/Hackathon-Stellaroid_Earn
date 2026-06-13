import assert from "node:assert/strict";
import test from "node:test";
import {
  base45Decode,
  base45Encode,
  decodeOfflinePayload,
  encodeOfflinePayload,
  OFFLINE_PAYLOAD_PREFIX,
  type OfflineCredentialPayload,
} from "./offline-payload.ts";
import { buildSignableCredential } from "./open-badge.ts";
import { getProofMetadata } from "./proof-metadata.ts";
import { DEFAULT_SAMPLE_PROOF_HASH } from "./demo-data.ts";

const ISSUER = "GAWIOVGFSPJDEIJJZUSVRFPVP3D5VNO2LGCU47KEHJD6MV277QKNR34D";
// 64-byte ed25519 signature → 88 base64 chars, realistic shape.
const FAKE_SIG = Buffer.alloc(64, 7).toString("base64");

function realisticPayload(): OfflineCredentialPayload {
  const metadata = getProofMetadata(DEFAULT_SAMPLE_PROOF_HASH);
  assert.ok(metadata, "demo metadata fixture must exist");
  return {
    v: 1,
    credential: buildSignableCredential(DEFAULT_SAMPLE_PROOF_HASH, metadata),
    sig: FAKE_SIG,
    issuer: ISSUER,
  };
}

test("base45 matches the RFC 9285 examples", () => {
  const encode = (text: string) => base45Encode(new TextEncoder().encode(text));
  assert.equal(encode("AB"), "BB8");
  assert.equal(encode("Hello!!"), "%69 VD92EX0");
  assert.equal(encode("base-45"), "UJCLQE7W581");

  const decode = (text: string) => new TextDecoder().decode(base45Decode(text));
  assert.equal(decode("QED8WEX0"), "ietf!");
  assert.equal(decode("BB8"), "AB");
});

test("base45 round-trips odd- and even-length byte strings", () => {
  for (const length of [0, 1, 2, 3, 64, 255]) {
    const bytes = new Uint8Array(length).map((_, i) => (i * 37 + length) % 256);
    const decoded = base45Decode(base45Encode(bytes));
    assert.deepEqual([...decoded], [...bytes]);
  }
});

test("base45 rejects invalid input", () => {
  // Lowercase is outside the RFC 9285 alphabet.
  assert.throws(() => base45Decode("bb8"), /bad-base45/);
  // '#' is not in the alphabet.
  assert.throws(() => base45Decode("BB#"), /bad-base45/);
  // A leftover single character can never encode a byte.
  assert.throws(() => base45Decode("BB8A"), /bad-base45/);
  // Triple decoding above 0xffff is invalid (":::" → 91124).
  assert.throws(() => base45Decode(":::"), /bad-base45/);
  // Trailing pair above 0xff is invalid ("::" → 2024).
  assert.throws(() => base45Decode("::"), /bad-base45/);
});

test("payload round-trips through encode/decode", async () => {
  const payload = realisticPayload();
  const encoded = await encodeOfflinePayload(payload);

  assert.ok(encoded.startsWith(OFFLINE_PAYLOAD_PREFIX));
  // QR alphanumeric-mode compatibility: prefix + base45 alphabet only.
  assert.match(encoded, /^SLR1:[0-9A-Z $%*+\-./:]+$/);

  const decoded = await decodeOfflinePayload(encoded);
  assert.deepEqual(decoded, payload);
});

test("decode rejects a missing or wrong prefix with bad-prefix", async () => {
  const encoded = await encodeOfflinePayload(realisticPayload());
  await assert.rejects(
    decodeOfflinePayload(encoded.slice(OFFLINE_PAYLOAD_PREFIX.length)),
    { message: "bad-prefix" },
  );
  await assert.rejects(decodeOfflinePayload(`SLR2:${encoded.slice(5)}`), {
    message: "bad-prefix",
  });
  await assert.rejects(decodeOfflinePayload(""), { message: "bad-prefix" });
});

test("decode rejects invalid base45 with bad-base45", async () => {
  await assert.rejects(decodeOfflinePayload("SLR1:bb8"), {
    message: "bad-base45",
  });
  await assert.rejects(decodeOfflinePayload("SLR1:BB8A"), {
    message: "bad-base45",
  });
});

test("decode rejects corrupt deflate streams with bad-deflate", async () => {
  // Valid base45, but the bytes are not a deflate-raw stream.
  const junk = base45Encode(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
  await assert.rejects(decodeOfflinePayload(`SLR1:${junk}`), {
    message: "bad-deflate",
  });

  // Truncated-but-prefix-valid stream must also fail.
  const encoded = await encodeOfflinePayload(realisticPayload());
  const deflated = base45Decode(encoded.slice(OFFLINE_PAYLOAD_PREFIX.length));
  const truncated = base45Encode(deflated.subarray(0, 8));
  await assert.rejects(decodeOfflinePayload(`SLR1:${truncated}`), {
    message: "bad-deflate",
  });
});

test("decode rejects well-compressed non-payload content with bad-shape", async () => {
  async function encodeRaw(text: string): Promise<string> {
    const stream = new Blob([new TextEncoder().encode(text) as BlobPart])
      .stream()
      .pipeThrough(new CompressionStream("deflate-raw"));
    const deflated = new Uint8Array(await new Response(stream).arrayBuffer());
    return OFFLINE_PAYLOAD_PREFIX + base45Encode(deflated);
  }

  // Not JSON at all.
  await assert.rejects(decodeOfflinePayload(await encodeRaw("not json")), {
    message: "bad-shape",
  });
  // JSON, wrong shapes.
  for (const wrong of [
    "[]",
    "null",
    '"hello"',
    '{"v":2,"credential":{},"sig":"x","issuer":"G"}',
    '{"v":1,"credential":[],"sig":"x","issuer":"G"}',
    '{"v":1,"credential":{},"sig":7,"issuer":"G"}',
    '{"v":1,"credential":{},"sig":"x"}',
  ]) {
    await assert.rejects(decodeOfflinePayload(await encodeRaw(wrong)), {
      message: "bad-shape",
    });
  }
});

test("realistic demo credential stays within the 1800-char QR budget", async () => {
  const encoded = await encodeOfflinePayload(realisticPayload());
  assert.ok(
    encoded.length <= 1800,
    `encoded payload is ${encoded.length} chars (budget 1800)`,
  );
});
