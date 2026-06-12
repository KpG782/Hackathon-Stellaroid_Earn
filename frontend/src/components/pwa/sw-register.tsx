"use client";

import { useEffect } from "react";
import { toast } from "sonner";

// Registers the service worker from compiled bundle code so the nonce-based
// CSP in src/middleware.ts is never involved (no inline script).
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    const promptUpdate = (registration: ServiceWorkerRegistration) => {
      const waiting = registration.waiting;
      if (!waiting) return;
      toast("Update available", {
        description: "A new version of Stellaroid is ready.",
        duration: Infinity,
        action: {
          label: "Refresh",
          onClick: () => waiting.postMessage({ type: "SKIP_WAITING" }),
        },
      });
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        promptUpdate(registration);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          installing?.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              promptUpdate(registration);
            }
          });
        });
      })
      .catch(() => {
        // PWA is progressive enhancement; registration failures stay silent.
      });

    // First-install claim (controller: null → SW) must not reload the page;
    // only an accepted update (controller swap) does.
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  return null;
}
