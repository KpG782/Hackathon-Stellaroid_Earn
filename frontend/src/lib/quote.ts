import { withTimeout } from "./with-timeout.ts";
import { COINGECKO_ID, type PayoutAsset } from "./payout-asset.ts";

if (typeof window !== "undefined") {
  throw new Error("quote module is server-only and must not be imported in a client bundle");
}

export type QuoteSource = "pdax-staging" | "coingecko" | "cache";

export type Quote = {
  price: number;
  asOf: string;
  source: QuoteSource;
  stale: boolean;
};

export type QuoteDeps = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  pdaxTicker?: (pair: string) => Promise<{ last: string; timestamp: string }>;
};

const COINGECKO_BASE = "https://api.coingecko.com/api/v3/simple/price";
const PROVIDER_TIMEOUT_MS = 5_000;
const DEFAULT_TTL_SECONDS = 60;

function coingeckoUrl(asset: PayoutAsset): string {
  return `${COINGECKO_BASE}?ids=${COINGECKO_ID[asset]}&vs_currencies=php`;
}

type CacheEntry = {
  price: number;
  asOf: string;
  fetchedAt: number;
};

const lastGoodByAsset = new Map<PayoutAsset, CacheEntry>();

export function resetQuoteCacheForTests() {
  lastGoodByAsset.clear();
}

function getTtlMs(): number {
  const raw = Number(process.env.QUOTE_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  const seconds = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_SECONDS;
  return seconds * 1000;
}

async function defaultPdaxTicker(pair: string) {
  const { getTicker } = await import("./pdax-client.ts");
  const ticker = await getTicker(pair);
  return { last: ticker.last, timestamp: ticker.timestamp };
}

function parsePrice(value: unknown): number | null {
  const price = typeof value === "string" ? Number(value) : value;
  return typeof price === "number" && Number.isFinite(price) && price > 0
    ? price
    : null;
}

async function fetchPdaxQuote(
  deps: Required<Pick<QuoteDeps, "now">> & QuoteDeps,
): Promise<Quote | null> {
  const ticker = await withTimeout(
    (deps.pdaxTicker ?? defaultPdaxTicker)("XLM/PHP"),
    PROVIDER_TIMEOUT_MS,
    "PDAX ticker",
  );
  const price = parsePrice(ticker.last);
  if (price === null) return null;
  const asOf = Number.isNaN(Date.parse(ticker.timestamp))
    ? new Date(deps.now()).toISOString()
    : ticker.timestamp;
  return { price, asOf, source: "pdax-staging", stale: false };
}

async function fetchCoingeckoQuote(
  asset: PayoutAsset,
  deps: Required<Pick<QuoteDeps, "now">> & QuoteDeps,
): Promise<Quote | null> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const response = await withTimeout(
    fetchImpl(coingeckoUrl(asset), { headers: { Accept: "application/json" } }),
    PROVIDER_TIMEOUT_MS,
    "CoinGecko simple-price",
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as Record<string, { php?: unknown }>;
  const price = parsePrice(payload[COINGECKO_ID[asset]]?.php);
  if (price === null) return null;
  return {
    price,
    asOf: new Date(deps.now()).toISOString(),
    source: "coingecko",
    stale: false,
  };
}

/**
 * PHP price quote for an asset with a graceful provider chain:
 * PDAX staging ticker (XLM only, when PDAX_MODE=staging) → CoinGecko →
 * last-good cached value flagged stale → null. Never throws: a page
 * rendering a peso line must degrade by hiding it, not erroring.
 */
export async function getQuote(
  asset: PayoutAsset,
  fiat: "PHP",
  deps: QuoteDeps = {},
): Promise<Quote | null> {
  void fiat;
  const now = deps.now ?? Date.now;
  const nowMs = now();

  const cached = lastGoodByAsset.get(asset);
  if (cached && nowMs - cached.fetchedAt < getTtlMs()) {
    return { price: cached.price, asOf: cached.asOf, source: "cache", stale: false };
  }

  const providers: Array<() => Promise<Quote | null>> = [];
  // PDAX staging only quotes the XLM/PHP pair; USDC goes straight to CoinGecko.
  if (asset === "XLM" && process.env.PDAX_MODE?.toLowerCase() === "staging") {
    providers.push(() => fetchPdaxQuote({ ...deps, now }));
  }
  providers.push(() => fetchCoingeckoQuote(asset, { ...deps, now }));

  for (const provider of providers) {
    try {
      const quote = await provider();
      if (quote) {
        lastGoodByAsset.set(asset, {
          price: quote.price,
          asOf: quote.asOf,
          fetchedAt: nowMs,
        });
        return quote;
      }
    } catch {
      // Fall through to the next provider in the chain.
    }
  }

  if (cached) {
    return { price: cached.price, asOf: cached.asOf, source: "cache", stale: true };
  }

  return null;
}
