"use client";

import { useEffect } from "react";

/** Registers public/sw.js once the page has loaded; Settings subscribes to push through it. */
export function ServiceWorkerRegister({ appName }: { appName: string }) {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      // The name rides along on the URL: a static worker cannot read env.
      navigator.serviceWorker.register(`/sw.js?app=${encodeURIComponent(appName)}`).catch(() => {
        // Non-fatal: the app still works without an installed service worker.
      });
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, [appName]);

  return null;
}
