"use client";

import { useEffect } from "react";
import type { Theme } from "@/lib/types";

/** Stamps (or clears) `data-theme` on <html> from UserSettings.theme. */
export function ThemeStamp({ theme }: { theme: Theme }) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
  }, [theme]);

  return null;
}
