/**
 * Payout-recipient address domain: a payout can be received by either a
 * classic Stellar account (G-address, e.g. Freighter) or a Soroban smart-
 * wallet contract (C-address, e.g. a passkey wallet — APAC spec §4). This is
 * the single place that decides which address shapes are payable, so the
 * intent token, the payment detector, and any UI validation agree.
 *
 * Isomorphic and zero-dep (built on strkey-lite, no @stellar/stellar-sdk), so
 * it is safe in client and server bundles alike.
 */
import {
  isValidContractAddress,
  isValidEd25519PublicKey,
} from "./strkey-lite.ts";

export type RecipientKind = "ed25519" | "contract";

/**
 * Classifies a payout recipient address. Returns "ed25519" for a valid
 * classic account (G), "contract" for a valid smart-wallet contract (C), or
 * null for anything that is neither (so callers can reject it up front).
 */
export function classifyRecipient(address: string): RecipientKind | null {
  if (isValidEd25519PublicKey(address)) return "ed25519";
  if (isValidContractAddress(address)) return "contract";
  return null;
}

/** True iff `address` can be a payout recipient (classic account or contract). */
export function isValidRecipientAddress(address: string): boolean {
  return classifyRecipient(address) !== null;
}
