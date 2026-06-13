/**
 * Signs a credential's canonical signable content with the demo issuer's
 * Stellar key so the proof gains an offline-verifiable issuerSignature
 * block (sep43-ed25519; see src/lib/credential-sign.ts).
 *
 * Loads the on-chain certificate and proof metadata exactly the way the
 * credential.json route does, builds buildSignableCredential(hash, meta),
 * signs its SEP-43 digest, self-verifies, and prints the issuerSignature
 * JSON block to stdout. Status/diagnostics go to stderr.
 *
 * Idempotent: an existing signature (in the app metadata or the target
 * file) that still verifies for the current signable content and the same
 * issuer key is reused instead of re-signed, so repeated runs do not churn
 * `signedAt` or rewrite files.
 *
 * Usage:
 *   npm run ops:sign-credential -- <certHash> [--write]
 *
 * Env: DEMO_ISSUER_SECRET — the issuer's S... seed (never logged).
 * --write updates public/proof-metadata/<hash>.json (or sample.json for the
 * default demo hash) in place when such a file exists. Note: the app
 * currently serves metadata from the in-module record in
 * src/lib/proof-metadata.ts — paste the printed block there for the hash so
 * credential.json and the offline QR pick it up.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Keypair } from "@stellar/stellar-sdk";
import { getCertificateServer } from "../src/lib/contract-read-server.ts";
import {
  canonicalCredentialBytes,
  sep43Digest,
  verifyCredentialSignature,
} from "../src/lib/credential-sign.ts";
import { DEFAULT_SAMPLE_PROOF_HASH } from "../src/lib/demo-data.ts";
import { buildSignableCredential } from "../src/lib/open-badge.ts";
import {
  getProofMetadataForCertificate,
  sanitizeIssuerSignature,
  type IssuerSignature,
} from "../src/lib/proof-metadata.ts";

const HASH_RE = /^[0-9a-f]{64}$/i;

function fail(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

function metadataFileForHash(hash: string): string | null {
  const dir = fileURLToPath(new URL("../public/proof-metadata/", import.meta.url));
  const byHash = `${dir}${hash}.json`;
  if (existsSync(byHash)) return byHash;
  // sample.json is the hosted metadata for the default demo certificate
  // (its on-chain metadata_uri points at /proof-metadata/sample.json).
  if (hash === DEFAULT_SAMPLE_PROOF_HASH.toLowerCase()) {
    const sample = `${dir}sample.json`;
    if (existsSync(sample)) return sample;
  }
  return null;
}

function readFileSignature(filePath: string | null): {
  json: Record<string, unknown> | null;
  signature: IssuerSignature | null;
} {
  if (!filePath) return { json: null, signature: null };
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Record<
      string,
      unknown
    >;
    return { json: parsed, signature: sanitizeIssuerSignature(parsed.issuerSignature) };
  } catch {
    return { json: null, signature: null };
  }
}

async function reusableSignature(
  candidate: IssuerSignature | null,
  signable: Record<string, unknown>,
  issuerAddress: string,
): Promise<IssuerSignature | null> {
  if (!candidate || candidate.issuer !== issuerAddress) return null;
  const valid = await verifyCredentialSignature({
    credential: signable,
    signatureBase64: candidate.sig,
    issuerAddress: candidate.issuer,
  });
  return valid ? candidate : null;
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const hashArg = args.find((arg) => !arg.startsWith("--"));

  if (!hashArg || !HASH_RE.test(hashArg.trim())) {
    console.error(
      "Usage: npm run ops:sign-credential -- <certHash (64 hex chars)> [--write]",
    );
    process.exit(1);
  }
  const hash = hashArg.trim().toLowerCase();

  const secret = process.env.DEMO_ISSUER_SECRET;
  if (!secret) {
    fail("DEMO_ISSUER_SECRET is not set (expected the issuer's S... seed)");
  }
  let keypair: Keypair;
  try {
    keypair = Keypair.fromSecret(secret.trim());
  } catch {
    // Never echo the secret — not even partially.
    fail("DEMO_ISSUER_SECRET is not a valid Stellar secret seed");
  }
  const issuerAddress = keypair.publicKey();

  // Load the certificate and metadata the same way credential.json does, so
  // the signed bytes match what the route (and the offline QR) rebuilds.
  const cert = await getCertificateServer(hash);
  if (!cert) {
    fail(`no on-chain certificate found for hash ${hash}`);
  }
  const metadata = await getProofMetadataForCertificate(hash, cert);
  if (!metadata) {
    fail(`no proof metadata resolvable for hash ${hash}`);
  }
  if (cert.issuer !== issuerAddress) {
    console.error(
      `note: signing key ${issuerAddress} differs from the on-chain cert issuer ${cert.issuer}`,
    );
  }

  const signable = buildSignableCredential(hash, metadata);
  const filePath = metadataFileForHash(hash);
  const fileState = readFileSignature(filePath);

  // Idempotency: prefer an existing, still-valid signature by this key.
  let block =
    (await reusableSignature(metadata.issuerSignature ?? null, signable, issuerAddress)) ??
    (await reusableSignature(fileState.signature, signable, issuerAddress));
  let reused = true;

  if (!block) {
    reused = false;
    const digest = await sep43Digest(canonicalCredentialBytes(signable));
    const sig = keypair.sign(Buffer.from(digest)).toString("base64");
    block = {
      alg: "sep43-ed25519",
      sig,
      issuer: issuerAddress,
      signedAt: new Date().toISOString(),
    };
  }

  const selfCheck = await verifyCredentialSignature({
    credential: signable,
    signatureBase64: block.sig,
    issuerAddress: block.issuer,
  });
  if (!selfCheck) {
    fail("self-verification of the produced signature failed");
  }

  console.error(
    reused
      ? "existing signature still verifies — reusing it (idempotent run)"
      : `signed canonical credential for ${hash} as ${issuerAddress}`,
  );

  if (write) {
    if (!filePath || !fileState.json) {
      console.error(
        "--write: no writable metadata JSON file maps to this hash under public/proof-metadata/ — nothing written",
      );
    } else if (
      JSON.stringify(fileState.signature) === JSON.stringify(block)
    ) {
      console.error(`--write: ${filePath} already up to date`);
    } else {
      const next = { ...fileState.json, issuerSignature: block };
      writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
      console.error(`--write: updated ${filePath}`);
    }
    console.error(
      "reminder: the app serves metadata from PROOF_METADATA in src/lib/proof-metadata.ts — add the printed issuerSignature block there for this hash",
    );
  }

  // The issuerSignature block is the only stdout output, so it can be piped.
  console.log(JSON.stringify({ issuerSignature: block }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, fatal: String(error) }));
  process.exit(1);
});
