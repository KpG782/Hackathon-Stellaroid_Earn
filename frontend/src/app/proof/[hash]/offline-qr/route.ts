// Self-contained offline verification QR. Unlike /proof/[hash]/qr (which
// encodes a URL), this encodes the full signed credential payload so the
// Stellaroid verifier at /verify can check it with zero connectivity.
// Same hash gate as the sibling qr route; 404 when the credential has no
// issuer signature.

import QRCode from "qrcode";
import { getCertificateServer } from "@/lib/contract-read-server";
import { getProofMetadataForCertificate } from "@/lib/proof-metadata";
import { buildSignableCredential } from "@/lib/open-badge";
import { encodeOfflinePayload } from "@/lib/offline-payload";

export const revalidate = 3600;

const HASH_RE = /^[0-9a-f]{64}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash: rawHash } = await params;
  const hash = rawHash.trim().replace(/^0x/i, "").toLowerCase();

  if (!HASH_RE.test(hash)) {
    return new Response("Certificate hash must be 64 hexadecimal characters.", {
      status: 404,
    });
  }

  let cert;
  try {
    cert = await getCertificateServer(hash);
  } catch {
    return new Response("Credential lookup is temporarily unavailable.", {
      status: 503,
    });
  }
  if (!cert) {
    return new Response("Credential not found.", { status: 404 });
  }

  const metadata = await getProofMetadataForCertificate(hash, cert);
  const signature = metadata?.issuerSignature;
  if (!metadata || !signature) {
    return new Response(
      "Offline verification is not enabled for this credential.",
      { status: 404 },
    );
  }

  const payload = await encodeOfflinePayload({
    v: 1,
    credential: buildSignableCredential(hash, metadata),
    sig: signature.sig,
    issuer: signature.issuer,
  });

  // Error correction "L": the deflated payload is large (~1.8k chars), and a
  // bright phone screen at close range doesn't need M-level redundancy.
  const svg = await QRCode.toString(payload, {
    type: "svg",
    margin: 1,
    width: 320,
    color: { dark: "#0F172A", light: "#F8FAFC" },
    errorCorrectionLevel: "L",
  });

  return new Response(svg, {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=604800",
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  });
}
