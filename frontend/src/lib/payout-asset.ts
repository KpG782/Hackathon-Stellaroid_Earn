/**
 * Payout asset domain (APAC spec §5, Pillar 3). A credential-gated payout is
 * denominated in XLM or USDC. USDC is the default for the mainnet demo
 * (stablecoin payroll is the proven APAC wedge); old intent tokens with no
 * asset are read as XLM, so versioning stays backward compatible.
 *
 * Client-safe and zero-dep: shared by the employer form, the intent codec, the
 * payment detector, and the fiat quote so they agree on the asset set.
 */
export type PayoutAsset = "XLM" | "USDC";

/** Selectable assets, USDC first so it is the employer default. */
export const PAYOUT_ASSETS: readonly PayoutAsset[] = ["USDC", "XLM"] as const;

export function isPayoutAsset(value: unknown): value is PayoutAsset {
  return value === "XLM" || value === "USDC";
}

/** Coerces an unknown/legacy value to an asset: anything non-USDC reads as XLM. */
export function normalizePayoutAsset(value: unknown): PayoutAsset {
  return value === "USDC" ? "USDC" : "XLM";
}

/** CoinGecko market id used to quote each asset's fiat price. */
export const COINGECKO_ID: Record<PayoutAsset, string> = {
  XLM: "stellar",
  USDC: "usd-coin",
};
