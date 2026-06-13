// Submits a graduate's signed passkey-wallet deploy transaction through the
// configured relayer so onboarding costs the graduate zero XLM (APAC spec §4).
// Returns 503 when no relayer is provisioned — the client then keeps the
// Freighter flow. Relayer secrets stay server-only (Working Agreement rule 4).
import { NextResponse } from "next/server";
import {
  getPasskeyServerConfig,
  isLikelyTransactionXdr,
  submitDeployTransaction,
} from "@/lib/passkey-server";
import { createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  if (!getPasskeyServerConfig()) {
    return NextResponse.json(
      { error: "Passkey wallet onboarding is not available on this deployment." },
      { status: 503 },
    );
  }

  if (!limiter.check(clientKey(request))) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let body: { xdr?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isLikelyTransactionXdr(body.xdr)) {
    return NextResponse.json(
      { error: "Expected a base64 transaction XDR." },
      { status: 400 },
    );
  }

  try {
    const result = await submitDeployTransaction(body.xdr);
    return NextResponse.json(result);
  } catch {
    // Never leak relayer internals/secrets in the error surface.
    return NextResponse.json(
      { error: "The relayer could not submit the wallet deployment. Try again." },
      { status: 502 },
    );
  }
}
