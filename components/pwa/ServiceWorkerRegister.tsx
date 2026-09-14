"use client";

import { useEffect } from "react";

/** Registers public/sw.js once the page has loaded. No push UI yet (Phase B). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal: the app still works without an installed service worker.
      });
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
