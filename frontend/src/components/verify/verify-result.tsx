"use client";

// Verification result card for /verify. The whole pipeline runs on-device so
// it works fully offline: decode the SLR1: payload → check the issuer against
// the bundled registry → verify the ed25519 signature. When connectivity is
// available (on mount or via the window "online" event) the offline result
// upgrades to an on-chain re-check by fetching the served credential.json.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyCredentialSignature } from "@/lib/credential-sign";
import { decodeOfflinePayload } from "@/lib/offline-payload";
import { lookupIssuer } from "@/lib/issuer-registry";
import { shortenAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

const HASH_RE = /^[0-9a-f]{64}$/i;
const PROOF_PATH_RE = /\/proof\/([0-9a-f]{64})(?:\/|$)/i;
const DECODE_CODES = new Set(["bad-prefix", "bad-base45", "bad-deflate", "bad-shape"]);

type FailureReason = "malformed" | "unknown-issuer" | "bad-signature";

type VerifyState =
  | { kind: "checking" }
  | { kind: "verified-offline"; issuerName: string; hash: string | null }
  | { kind: "verified-onchain"; issuerName: string; hash: string }
  | { kind: "failed"; reason: FailureReason; detail: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Pull the on-chain certificate hash out of a credential object. Handles
 * both shapes in play: the signable credential carried in QR payloads keeps
 * `identifier[].identityHash` at the top level (buildSignableCredential),
 * while the served credential.json nests it under
 * `credentialSubject.identifier[]` (buildOpenBadgeCredential). Falls back to
 * direct hash fields and `/proof/{hash}` URLs for robustness.
 */
export function extractCertificateHash(
  credential: Record<string, unknown>,
): string | null {
  const subject = asRecord(credential.credentialSubject);
  for (const identifiers of [credential.identifier, subject?.identifier]) {
    if (!Array.isArray(identifiers)) continue;
    for (const entry of identifiers) {
      const identityHash = asRecord(entry)?.identityHash;
      if (typeof identityHash === "string" && HASH_RE.test(identityHash)) {
        return identityHash.toLowerCase();
      }
    }
  }

  for (const key of ["hash", "certHash", "certificateHash", "identityHash"]) {
    const value = credential[key];
    if (typeof value === "string" && HASH_RE.test(value)) {
      return value.toLowerCase();
    }
  }

  const urlCandidates = [credential.id, asRecord(subject?.achievement)?.id];
  for (const candidate of urlCandidates) {
    if (typeof candidate === "string") {
      const match = PROOF_PATH_RE.exec(candidate);
      if (match) return match[1].toLowerCase();
    }
  }

  return null;
}

export interface VerifyResultProps {
  /** Raw scanned/pasted text — expected to be an "SLR1:" offline payload. */
  payload: string;
  /** Return to the scanner view. */
  onRescan: () => void;
}

export function VerifyResult({ payload, onRescan }: VerifyResultProps) {
  const [state, setState] = useState<VerifyState>({ kind: "checking" });

  // Offline pipeline: decode → registry lookup → signature check.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      let decoded;
      try {
        decoded = await decodeOfflinePayload(payload);
      } catch (error) {
        const code =
          error instanceof Error && DECODE_CODES.has(error.message)
            ? error.message
            : "bad-shape";
        if (!cancelled) {
          setState({
            kind: "failed",
            reason: "malformed",
            detail: `This isn't a valid Stellaroid offline credential code (${code}). Make sure you scanned the offline QR from a proof page.`,
          });
        }
        return;
      }

      const issuerInfo = lookupIssuer(decoded.issuer);
      if (!issuerInfo) {
        if (!cancelled) {
          setState({
            kind: "failed",
            reason: "unknown-issuer",
            detail: `The signing account ${shortenAddress(decoded.issuer, 6)} is not in the bundled issuer registry, so this credential can't be trusted offline.`,
          });
        }
        return;
      }

      const valid = await verifyCredentialSignature({
        credential: decoded.credential,
        signatureBase64: decoded.sig,
        issuerAddress: decoded.issuer,
      });
      if (cancelled) return;

      if (!valid) {
        setState({
          kind: "failed",
          reason: "bad-signature",
          detail: `The credential contents don't match the signature from ${issuerInfo.name}. The QR may be tampered with or out of date.`,
        });
        return;
      }

      setState({
        kind: "verified-offline",
        issuerName: issuerInfo.name,
        hash: extractCertificateHash(decoded.credential),
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [payload]);

  // Auto-upgrade: when online (now, or as soon as connectivity returns),
  // fetch the served credential.json and confirm it carries the same hash.
  useEffect(() => {
    if (state.kind !== "verified-offline" || !state.hash) return;
    const { hash, issuerName } = state;
    let cancelled = false;

    const attempt = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      try {
        const response = await fetch(`/proof/${hash}/credential.json`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const served: unknown = await response.json();
        const servedRecord = asRecord(served);
        const servedHash = servedRecord
          ? extractCertificateHash(servedRecord)
          : null;
        if (!cancelled && servedHash === hash) {
          setState({ kind: "verified-onchain", issuerName, hash });
        }
      } catch {
        // Still offline or RPC unreachable — the offline result stands.
      }
    };

    void attempt();
    const onOnline = () => {
      void attempt();
    };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [state]);

  const tone =
    state.kind === "verified-offline"
      ? "border-primary/40 bg-primary/10"
      : state.kind === "verified-onchain"
        ? "border-success/40 bg-success/10"
        : state.kind === "failed"
          ? "border-danger/40 bg-danger/10"
          : "border-border bg-surface-2";

  const failureTitle: Record<FailureReason, string> = {
    malformed: "Malformed QR code",
    "unknown-issuer": "Issuer not in registry",
    "bad-signature": "Signature invalid",
  };

  return (
    <section
      role="status"
      aria-label="Verification result"
      className={cn(
        "rounded-2xl border p-6 flex flex-col gap-4",
        "transition-[background-color,border-color,opacity] duration-200",
        tone,
      )}
    >
      {state.kind === "checking" ? (
        // globals.css zeroes animation-duration under prefers-reduced-motion.
        <p className="m-0 text-sm text-text-muted animate-pulse">Verifying…</p>
      ) : null}

      {state.kind === "verified-offline" ? (
        <>
          <div className="flex items-start gap-3">
            <ShieldAlert
              className="w-7 h-7 text-primary shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="m-0 text-base font-semibold text-primary">
                Verified offline — pending chain re-check
              </p>
              <p className="m-0 mt-1 text-sm text-text-muted leading-relaxed">
                Signature valid · issued by {state.issuerName}
              </p>
            </div>
          </div>
          <p className="m-0 flex items-center gap-2 text-[0.8125rem] text-text-muted">
            <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
            Will re-check on Stellar automatically once this device is back
            online.
          </p>
        </>
      ) : null}

      {state.kind === "verified-onchain" ? (
        <>
          <div className="flex items-start gap-3">
            <ShieldCheck
              className="w-7 h-7 text-success shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="m-0 text-base font-semibold text-success">
                Verified on Stellar
              </p>
              <p className="m-0 mt-1 text-sm text-text-muted leading-relaxed">
                Signature valid · issued by {state.issuerName}
              </p>
            </div>
          </div>
          <Link
            href={`/proof/${state.hash}`}
            prefetch={false}
            className="inline-flex min-h-[44px] items-center self-start text-sm font-semibold text-accent no-underline hover:underline"
          >
            View full proof page →
          </Link>
        </>
      ) : null}

      {state.kind === "failed" ? (
        <>
          <div className="flex items-start gap-3">
            <ShieldX
              className="w-7 h-7 text-danger shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="m-0 text-base font-semibold text-danger">
                {failureTitle[state.reason]}
              </p>
              <p className="m-0 mt-1 text-sm text-text-muted leading-relaxed">
                {state.detail}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="secondary" onClick={onRescan}>
              Scan again
            </Button>
            <Link
              href="/proof"
              prefetch={false}
              className="inline-flex min-h-[44px] items-center text-sm font-semibold text-accent no-underline hover:underline"
            >
              Enter hash manually →
            </Link>
          </div>
        </>
      ) : null}

      {state.kind === "verified-offline" || state.kind === "verified-onchain" ? (
        <Button variant="ghost" onClick={onRescan} className="self-start">
          Scan another code
        </Button>
      ) : null}
    </section>
  );
}

export default VerifyResult;
