import type { CertificateRecord } from "./contract-read-server.ts";
import type { IssuerInfo } from "./issuer-registry.ts";
import type { SignedProofMetadata } from "./proof-metadata.ts";
import type { ProofMetadata } from "./types.ts";

/**
 * Open Badges 3.0 / W3C VC Data Model 2.0 credential document.
 *
 * When the proof metadata carries an `issuerSignature`, the document embeds
 * a `proof`-shaped block describing our custom signature scheme
 * (`StellarSep43Signature2026`): ed25519 by the issuer's Stellar key over
 * the SEP-43 digest of the canonical `buildSignableCredential` output —
 * sign-then-attach, so the signed bytes never include the proof block
 * itself. This is honestly labelled as a custom cryptosuite; a W3C Data
 * Integrity proof (eddsa-jcs-2022) remains roadmap and is NOT claimed.
 * Without a signature, the on-chain hash anchored on Stellar stays the
 * verification path, exposed via the human-readable proof page.
 */
export type StellarSep43Proof = {
  type: "StellarSep43Signature2026";
  cryptosuite: "sep43-ed25519";
  verificationMethod: string; // issuer Stellar G-address
  created: string; // ISO 8601 signing time (informational; not signed)
  proofValue: string; // base64 ed25519 signature
};

export type OpenBadgeCredential = {
  "@context": readonly [string, string];
  type: readonly ["VerifiableCredential", "OpenBadgeCredential"];
  id: string;
  issuer: {
    id: string;
    type: "Profile";
    name: string;
    url?: string;
  };
  validFrom: string;
  validUntil?: string;
  credentialSubject: {
    type: readonly ["AchievementSubject"];
    identifier: readonly [
      {
        type: "IdentityObject";
        identityHash: string;
        identityType: "identifier";
        hashed: true;
        salt: "not-salted";
      },
    ];
    achievement: {
      id: string;
      type: readonly ["Achievement"];
      name: string;
      description: string;
      criteria?: { narrative: string };
      tag: string[];
    };
  };
  "https://stellaroid.tech/ns#network": string;
  proof?: StellarSep43Proof;
};

export type OpenBadgeInput = {
  hash: string;
  baseUrl: string;
  network: "testnet" | "mainnet";
  cert: CertificateRecord;
  metadata: SignedProofMetadata | null;
  issuerInfo: IssuerInfo | null;
};

const FALLBACK_TITLE = "On-chain credential";
const FALLBACK_DESCRIPTION =
  "This credential is anchored on Stellar and carries contract-backed title, issuer, and status data.";

function epochSecondsToIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

/**
 * Shared between the served credential.json and the signable credential so
 * the signed content can never drift from what the document serves.
 */
function buildIdentityIdentifier(hash: string) {
  return [
    {
      type: "IdentityObject",
      identityHash: hash.toLowerCase(),
      identityType: "identifier",
      hashed: true,
      salt: "not-salted",
    },
  ] as const;
}

function buildAchievementContent(name: string, metadata: ProofMetadata | null) {
  const criteria = metadata?.criteria?.trim();
  return {
    type: ["Achievement"] as const,
    name,
    description: metadata?.description || FALLBACK_DESCRIPTION,
    ...(criteria ? { criteria: { narrative: criteria } } : {}),
    tag: metadata?.skills ? [...metadata.skills] : [],
  };
}

/**
 * THE single object that gets signed by the issuer, embedded (as a `proof`
 * block) in credential.json, and carried inside offline QR payloads.
 *
 * Derived from the same builders as the Open Badges credential so the
 * signed content matches what credential.json serves: `identifier` mirrors
 * `credentialSubject.identifier` and `achievement` mirrors
 * `credentialSubject.achievement` minus its deployment-specific URL `id`.
 * Deliberately excludes anything cert-, baseUrl-, or signature-dependent —
 * the bytes must be reproducible offline from (hash, metadata) alone, and
 * signing is sign-then-attach (never over a proof block).
 *
 * Note: metadata served by getProofMetadataForCertificate always carries a
 * non-empty title (sanitizeProofMetadata rejects empty titles), so the
 * achievement name here equals the one credential.json serves.
 */
export function buildSignableCredential(
  hash: string,
  meta: ProofMetadata,
): Record<string, unknown> {
  return {
    "https://stellaroid.tech/ns#signableVersion": 1,
    type: ["StellaroidSignableCredential", "AchievementSubject"],
    identifier: buildIdentityIdentifier(hash),
    achievement: buildAchievementContent(meta.title || FALLBACK_TITLE, meta),
  };
}

export function buildOpenBadgeCredential(
  input: OpenBadgeInput,
): OpenBadgeCredential {
  const { hash, baseUrl, network, cert, metadata, issuerInfo } = input;
  const credentialUrl = `${baseUrl}/proof/${hash}/credential.json`;
  const name = metadata?.title || cert.title.trim() || FALLBACK_TITLE;

  const credential: OpenBadgeCredential = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
    ],
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    id: credentialUrl,
    issuer: {
      id: `${baseUrl}/issuer#${cert.issuer}`,
      type: "Profile",
      name: issuerInfo?.name ?? cert.issuer,
      ...(issuerInfo?.url ? { url: issuerInfo.url } : {}),
    },
    validFrom: epochSecondsToIso(cert.issuedAt),
    credentialSubject: {
      type: ["AchievementSubject"],
      identifier: buildIdentityIdentifier(hash),
      achievement: {
        id: `${baseUrl}/proof/${hash}`,
        ...buildAchievementContent(name, metadata),
      },
    },
    "https://stellaroid.tech/ns#network": network,
  };

  if (cert.expiresAt > 0) {
    credential.validUntil = epochSecondsToIso(cert.expiresAt);
  }

  const issuerSignature = metadata?.issuerSignature;
  if (issuerSignature) {
    // Sign-then-attach: the signature covers buildSignableCredential output,
    // never this proof block. Custom scheme, honestly labelled — not a W3C
    // Data Integrity cryptosuite.
    credential.proof = {
      type: "StellarSep43Signature2026",
      cryptosuite: "sep43-ed25519",
      verificationMethod: issuerSignature.issuer,
      created: issuerSignature.signedAt,
      proofValue: issuerSignature.sig,
    };
  }

  return credential;
}
