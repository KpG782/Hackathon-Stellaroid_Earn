import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-2xl text-text">You&apos;re offline</h1>
      <p className="max-w-md text-sm text-text-muted">
        This page isn&apos;t cached yet. Proof pages you opened before are still
        available offline &mdash; and reconnecting re-verifies everything
        on-chain.
      </p>
    </main>
  );
}
