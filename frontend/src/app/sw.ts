/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // skipWaiting stays false: a new SW activates only after the user accepts
  // the update toast (sw-register.tsx posts SKIP_WAITING, which Serwist
  // handles natively).
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Public proof pages and their credential.json stay readable offline.
      // 64-hex gate mirrors the route's own hash validation.
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && /^\/proof\/[0-9a-f]{64}(\/|$)/i.test(url.pathname),
      handler: new StaleWhileRevalidate({
        cacheName: "proof-pages",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
