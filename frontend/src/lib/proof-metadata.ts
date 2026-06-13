import { DEFAULT_SAMPLE_PROOF_HASH } from "./demo-data.ts";
import type { ProofMetadata } from "./types.ts";
import type { CertificateRecord } from "./contract-read-server.ts";
import {
  isSafeExternalHttpUrl,
  sanitizeProofMetadata,
} from "./security.ts";
import { ed25519PublicKeyFromAddress } from "./strkey-lite.ts";

/**
 * Optional offline-verification block: an issuer's ed25519 signature over
 * the canonical signable credential (see credential-sign.ts /
 * buildSignableCredential). Additive — metadata without it behaves exactly
 * as before.
 */
export type IssuerSignature = {
  alg: "sep43-ed25519";
  sig: string; // base64 ed25519 signature
  issuer: string; // Stellar G-address (trust root)
  signedAt: string; // ISO 8601 timestamp (informational; not signed)
};

export type SignedProofMetadata = ProofMetadata & {
  issuerSignature?: IssuerSignature;
};

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Shape-validates an untrusted issuerSignature block, mirroring the
 * sanitize-before-serve pattern used for the rest of the metadata. Returns
 * null on anything malformed (wrong alg, non-base64 sig, bad G-address
 * checksum, unparseable timestamp). Does NOT verify the signature itself —
 * that is the verifier's job (credential-sign.ts).
 */
export function sanitizeIssuerSignature(value: unknown): IssuerSignature | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (obj.alg !== "sep43-ed25519") return null;
  if (typeof obj.sig !== "string" || !BASE64_RE.test(obj.sig)) return null;
  if (typeof obj.issuer !== "string") return null;
  try {
    ed25519PublicKeyFromAddress(obj.issuer);
  } catch {
    return null;
  }
  if (typeof obj.signedAt !== "string" || Number.isNaN(Date.parse(obj.signedAt))) {
    return null;
  }
  return {
    alg: "sep43-ed25519",
    sig: obj.sig,
    issuer: obj.issuer,
    signedAt: obj.signedAt,
  };
}

const PROOF_METADATA: Record<string, SignedProofMetadata> = {
  [DEFAULT_SAMPLE_PROOF_HASH.toLowerCase()]: {
    title: "Stellar Smart Contract Bootcamp Completion",
    description:
      "Awarded after shipping a working Soroban contract, deploying it to Stellar testnet, and demoing the full register, verify, and pay flow through Freighter.",
    cohort: "Stellar PH Bootcamp 2026",
    criteria:
      "Complete the assigned Soroban contract, pass the test suite, deploy to Stellar testnet, connect the dApp to Freighter, and present an end-to-end verified badge demo.",
    skills: [
      "Soroban smart contracts",
      "Stellar testnet deployment",
      "Freighter wallet integration",
      "Next.js dApp frontend",
      "On-chain credential verification",
    ],
    evidence: [
      {
        label: "About the demo",
        href: "/about",
      },
      {
        label: "Launch the app flow",
        href: "/app",
      },
      {
        label: "Bootcamp contract verified badge",
        href: "https://stellar.expert/explorer/testnet/contract/CDMUOHMARNVOJZM3IVOCJUPGBHDTHFBMZCCZXEZPQDVJGILH3NIKTTW3",
      },
    ],
  },
};

export function getProofMetadata(hash: string): SignedProofMetadata | null {
  const key = hash.trim().toLowerCase();
  return PROOF_METADATA[key] ?? null;
}

export async function getProofMetadataForCertificate(
  hash: string,
  cert: Pick<CertificateRecord, "title" | "cohort" | "metadataUri"> | null,
): Promise<SignedProofMetadata | null> {
  if (!cert) return null;

  const fallback = getProofMetadata(hash);
  const uri = cert.metadataUri.trim();

  // Keep issuer-supplied metadata URLs as links only. Fetching arbitrary remote
  // URLs during SSR can become SSRF through redirects, DNS rebinding, or private
  // network resolution that string-based URL checks cannot fully prove safe.
  const contractEvidence = uri && isSafeExternalHttpUrl(uri) ? [{ label: "Metadata source", href: uri }] : [];
  const title = cert.title.trim() || fallback?.title;
  const description = fallback?.description;

  if (!title && !description && !fallback && contractEvidence.length === 0) {
    return null;
  }

  const sanitized = sanitizeProofMetadata({
    title: title ?? "On-chain credential",
    description:
      description ??
      "This credential is anchored on Stellar and carries contract-backed title, issuer, and status data.",
    cohort: cert.cohort.trim() || fallback?.cohort,
    criteria: fallback?.criteria,
    skills: fallback?.skills ?? [],
    evidence: [...contractEvidence, ...(fallback?.evidence ?? [])],
  });
  if (!sanitized) return null;

  // Additive: carry the offline-verification block through (sanitizeProofMetadata
  // only knows the base shape and would otherwise drop it).
  const issuerSignature = sanitizeIssuerSignature(fallback?.issuerSignature);
  return issuerSignature ? { ...sanitized, issuerSignature } : sanitized;
}
