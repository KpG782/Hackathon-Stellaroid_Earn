// Server component — graduate-side "show offline QR" block on the proof page.
// Renders only when the credential metadata carries an issuer signature, i.e.
// when /proof/[hash]/offline-qr can actually serve a verifiable payload.

import Link from "next/link";
import type { SignedProofMetadata } from "@/lib/proof-metadata";

interface OfflineQrBlockProps {
  hash: string;
  metadata: SignedProofMetadata | null;
}

export function OfflineQrBlock({ hash, metadata }: OfflineQrBlockProps) {
  if (!metadata?.issuerSignature) return null;

  return (
    <div className="flex items-center gap-4">
      <img
        src={`/proof/${hash}/offline-qr`}
        alt="Offline verification QR code for this credential"
        width={160}
        height={160}
        loading="lazy"
        decoding="async"
        className="w-40 h-40 rounded shrink-0 bg-[#F8FAFC] p-1.5"
      />
      <div className="text-[0.8125rem] text-text-muted leading-relaxed">
        <strong className="block text-text text-sm mb-0.5">
          Offline verification QR
        </strong>
        Works without internet — scan with the Stellaroid verifier at{" "}
        <Link
          href="/verify"
          prefetch={false}
          className="text-accent no-underline hover:underline"
        >
          /verify
        </Link>
        . Turn screen brightness up.
      </div>
    </div>
  );
}

export default OfflineQrBlock;
