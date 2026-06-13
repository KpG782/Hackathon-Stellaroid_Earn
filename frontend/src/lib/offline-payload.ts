/**
 * Self-contained offline credential payload codec for QR transport:
 * "SLR1:" + base45(deflate-raw(JSON{v, credential, sig, issuer})) — the EU
 * health-pass pattern (RFC 9285 base45 stays inside the QR alphanumeric
 * character set, deflate keeps realistic credentials within QR capacity).
 *
 * Isomorphic and client-safe: hand-rolled base45 plus the native
 * CompressionStream / DecompressionStream APIs (browsers and Node 18+); no
 * zlib, no @stellar/stellar-sdk.
 */

export interface OfflineCredentialPayload {
  v: 1;
  credential: Record<string, unknown>;
  sig: string; // base64 ed25519 signature (see credential-sign.ts)
  issuer: string; // Stellar G-address trust root
}

export const OFFLINE_PAYLOAD_PREFIX = "SLR1:";

// RFC 9285 base45 alphabet (QR alphanumeric-mode subset).
const BASE45_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

const BASE45_CHAR_TO_VALUE = new Map<string, number>(
  [...BASE45_ALPHABET].map((char, index) => [char, index]),
);

/** Encodes bytes per RFC 9285: byte pairs → 3 chars, trailing byte → 2 chars. */
export function base45Encode(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    let n = bytes[i] * 256 + bytes[i + 1];
    const c = n % 45;
    n = (n - c) / 45;
    const d = n % 45;
    const e = (n - d) / 45;
    out += BASE45_ALPHABET[c] + BASE45_ALPHABET[d] + BASE45_ALPHABET[e];
  }
  if (bytes.length % 2 === 1) {
    const n = bytes[bytes.length - 1];
    const c = n % 45;
    const d = (n - c) / 45;
    out += BASE45_ALPHABET[c] + BASE45_ALPHABET[d];
  }
  return out;
}

/**
 * Decodes an RFC 9285 base45 string. Throws Error("bad-base45") on invalid
 * characters, a leftover single character, or out-of-range groups
 * (triples > 0xffff, trailing pairs > 0xff).
 */
export function base45Decode(text: string): Uint8Array {
  if (text.length % 3 === 1) {
    throw new Error("bad-base45");
  }

  const values: number[] = [];
  for (const char of text) {
    const value = BASE45_CHAR_TO_VALUE.get(char);
    if (value === undefined) {
      throw new Error("bad-base45");
    }
    values.push(value);
  }

  const out: number[] = [];
  const fullTriples = Math.floor(values.length / 3);
  for (let t = 0; t < fullTriples; t += 1) {
    const i = t * 3;
    const n = values[i] + values[i + 1] * 45 + values[i + 2] * 2025;
    if (n > 0xffff) {
      throw new Error("bad-base45");
    }
    out.push(Math.floor(n / 256), n % 256);
  }
  if (values.length % 3 === 2) {
    const i = values.length - 2;
    const n = values[i] + values[i + 1] * 45;
    if (n > 0xff) {
      throw new Error("bad-base45");
    }
    out.push(n);
  }

  return new Uint8Array(out);
}

async function pipeBytes(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

/** Serializes and compresses a payload into its QR string form. */
export async function encodeOfflinePayload(
  p: OfflineCredentialPayload,
): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(p));
  const deflated = await pipeBytes(json, new CompressionStream("deflate-raw"));
  return OFFLINE_PAYLOAD_PREFIX + base45Encode(deflated);
}

function isPayloadShape(value: unknown): value is OfflineCredentialPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.v === 1 &&
    typeof obj.credential === "object" &&
    obj.credential !== null &&
    !Array.isArray(obj.credential) &&
    typeof obj.sig === "string" &&
    typeof obj.issuer === "string"
  );
}

/**
 * Parses a scanned QR string back into a payload. Throws an Error whose
 * message is exactly one of "bad-prefix" | "bad-base45" | "bad-deflate" |
 * "bad-shape" so the verify UI can show a specific failure reason.
 */
export async function decodeOfflinePayload(
  s: string,
): Promise<OfflineCredentialPayload> {
  if (!s.startsWith(OFFLINE_PAYLOAD_PREFIX)) {
    throw new Error("bad-prefix");
  }

  const deflated = base45Decode(s.slice(OFFLINE_PAYLOAD_PREFIX.length));

  let json: Uint8Array;
  try {
    json = await pipeBytes(deflated, new DecompressionStream("deflate-raw"));
  } catch {
    throw new Error("bad-deflate");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(json));
  } catch {
    throw new Error("bad-shape");
  }

  if (!isPayloadShape(parsed)) {
    throw new Error("bad-shape");
  }

  return parsed;
}
