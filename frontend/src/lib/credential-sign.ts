/**
 * Offline credential signature primitives: canonical credential bytes,
 * the SEP-43 signed-message digest, and ed25519 verification keyed by a
 * Stellar G-address.
 *
 * Client-safe and isomorphic: only @noble/ed25519 (WebCrypto-backed async
 * API), WebCrypto SHA-256, and the zero-dep strkey decoder — never
 * @stellar/stellar-sdk (P1-3 bundle invariant). Works in browsers and in
 * Node 18+ unit tests unchanged.
 */
import { verifyAsync } from "@noble/ed25519";
import { ed25519PublicKeyFromAddress } from "./strkey-lite.ts";

const SIGNED_MESSAGE_PREFIX = "Stellar Signed Message:\n";
const ED25519_SIGNATURE_LENGTH = 64;

function sortValueDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValueDeep);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValueDeep(record[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Deterministic byte serialization of a credential object: recursively sort
 * object keys (arrays keep their order), JSON.stringify, UTF-8 encode.
 * Two structurally equal credentials always produce identical bytes,
 * regardless of property insertion order.
 */
export function canonicalCredentialBytes(
  credential: Record<string, unknown>,
): Uint8Array {
  const canonicalJson = JSON.stringify(sortValueDeep(credential));
  return new TextEncoder().encode(canonicalJson);
}

/**
 * SEP-43 signed-message digest: SHA-256 over
 * concat(UTF8("Stellar Signed Message:\n"), message).
 *
 * This is the single place the construction lives — signing (scripts) and
 * verification (client) both call it so the bytes can never drift.
 *
 * TODO(verify-freighter): validate byte-for-byte against real Freighter
 * signMessage output before live issuer signing ships.
 */
export async function sep43Digest(message: Uint8Array): Promise<Uint8Array> {
  const prefix = new TextEncoder().encode(SIGNED_MESSAGE_PREFIX);
  const combined = new Uint8Array(prefix.length + message.length);
  combined.set(prefix, 0);
  combined.set(message, prefix.length);
  const digest = await crypto.subtle.digest("SHA-256", combined);
  return new Uint8Array(digest);
}

function base64ToBytes(value: string): Uint8Array | null {
  if (value.length === 0 || value.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Verifies an issuer's ed25519 signature over
 * sep43Digest(canonicalCredentialBytes(credential)), with the public key
 * decoded from the issuer's Stellar G-address.
 *
 * Returns false on ANY invalid input (malformed address, garbage base64,
 * wrong signature length, unserializable credential) — never throws. Safe
 * to call directly on untrusted QR payload contents.
 */
export async function verifyCredentialSignature(opts: {
  credential: Record<string, unknown>;
  signatureBase64: string;
  issuerAddress: string;
}): Promise<boolean> {
  try {
    const publicKey = ed25519PublicKeyFromAddress(opts.issuerAddress);
    const signature = base64ToBytes(opts.signatureBase64);
    if (!signature || signature.length !== ED25519_SIGNATURE_LENGTH) {
      return false;
    }
    const digest = await sep43Digest(canonicalCredentialBytes(opts.credential));
    return await verifyAsync(signature, digest, publicKey);
  } catch {
    return false;
  }
}
