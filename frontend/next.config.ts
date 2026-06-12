import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import withSerwistInit from "@serwist/next";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // Spec P2-1: never hard-reload under the user; updates go through the
  // Sonner prompt in sw-register.tsx instead.
  reloadOnOnline: false,
  // App Router pages are not in the build precache manifest; the offline
  // fallback document must be added explicitly.
  additionalPrecacheEntries: [{ url: "/~offline", revision: crypto.randomUUID() }],
});

const nextConfig: NextConfig = {
  experimental: {
    // Keep local Windows builds deterministic; parallel static workers have
    // intermittently raced while writing .next trace/manifests in this repo.
    cpus: 1,
  },

  // Prevent webpack from bundling native Node.js modules pulled in by
  // @stellar/stellar-sdk → @stellar/stellar-base → sodium-native.
  // Webpack can't statically analyse sodium-native's dynamic require() calls
  // for native .node binaries — marking them external silences the warnings
  // and lets Node resolve them at runtime instead.
  serverExternalPackages: ["sodium-native", "@stellar/stellar-sdk", "@stellar/stellar-base"],

  // Hide the floating Next.js dev HUD so screenshots stay clean.
  devIndicators: false,

  async headers() {
    return [
      {
        // CSP is nonce-based and is applied from src/middleware.ts.
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            // Tell browsers to always use HTTPS for 2 years.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default withSerwist(withBundleAnalyzer(nextConfig));
