// Server component — the camera/crypto work lives in the client-side
// VerifyScanner. This page is precached by the PWA shell so an employer can
// open it and verify a credential with zero connectivity.

import type { Metadata } from "next";
import { SiteNav } from "@/components/layout/site-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { buildPageMetadata } from "@/lib/seo";
import { VerifyScanner } from "@/components/verify/scanner";

export const metadata: Metadata = buildPageMetadata({
  path: "/verify",
  title: "Verify a credential",
  description:
    "Scan a graduate's offline QR to verify their Stellaroid credential. Signature checks run on this device — no internet needed — and upgrade to on-chain verification when you're back online.",
  keywords:
    "offline credential verification, stellar credential QR, verify graduate credential, stellaroid verifier",
});

export default function VerifyPage() {
  return (
    <>
      <SiteNav />
      <main id="main" className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
        <header className="mb-6">
          <h1 className="font-heading text-2xl text-text">
            Verify a credential
          </h1>
          <p className="mt-2 text-sm text-text-muted leading-relaxed">
            Point the camera at a Stellaroid offline QR. Verification runs
            entirely on this device, so it works without internet.
          </p>
        </header>
        <VerifyScanner />
      </main>
      <SiteFooter />
    </>
  );
}
