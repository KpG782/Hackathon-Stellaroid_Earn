/**
 * Minimal, zero-dependency strkey decoder for Stellar ed25519 public keys
 * (G-addresses). Client-safe by design: offline QR verification must decode
 * the issuer address without pulling @stellar/stellar-sdk into the browser
 * bundle (P1-3 invariant). Cross-validated against the SDK's StrKey in
 * strkey-lite.test.ts only.
 *
 * Format (SEP-23): base32(version byte || 32-byte payload || CRC16-XModem
 * checksum, little-endian, over version byte + payload). G-addresses use
 * version byte 6 << 3 = 48 and are always 56 characters.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const ED25519_PUBLIC_KEY_VERSION_BYTE = 6 << 3; // 48 → leading "G"
const G_ADDRESS_LENGTH = 56;
const DECODED_LENGTH = 35; // 1 version + 32 payload + 2 checksum

function base32Decode(input: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const char of input) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("strkey-lite: invalid base32 character");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }

  // Canonical encoding: leftover bits past the final byte must be zero.
  if ((value & ((1 << bits) - 1)) !== 0) {
    throw new Error("strkey-lite: non-canonical base32 padding bits");
  }

  return new Uint8Array(out);
}

function crc16XModem(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

/**
 * Decodes a Stellar G-address to its raw 32-byte ed25519 public key.
 * Throws an Error on anything other than a well-formed ed25519 public-key
 * strkey: wrong length, invalid base32, wrong version byte, or checksum
 * mismatch (CRC16-XModem, little-endian trailer).
 */
export function ed25519PublicKeyFromAddress(gAddress: string): Uint8Array {
  if (typeof gAddress !== "string" || gAddress.length !== G_ADDRESS_LENGTH) {
    throw new Error("strkey-lite: G-address must be 56 characters");
  }

  const decoded = base32Decode(gAddress);
  if (decoded.length !== DECODED_LENGTH) {
    throw new Error("strkey-lite: unexpected decoded length");
  }

  const versionByte = decoded[0];
  if (versionByte !== ED25519_PUBLIC_KEY_VERSION_BYTE) {
    throw new Error("strkey-lite: not an ed25519 public key (bad version byte)");
  }

  const payload = decoded.subarray(0, DECODED_LENGTH - 2);
  const expected = crc16XModem(payload);
  const actual = decoded[DECODED_LENGTH - 2] | (decoded[DECODED_LENGTH - 1] << 8);
  if (expected !== actual) {
    throw new Error("strkey-lite: checksum mismatch");
  }

  return new Uint8Array(payload.subarray(1));
}
