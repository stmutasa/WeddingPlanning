"use client";

import { useState, type ReactNode } from "react";
import { KangaBand, ToastProvider } from "@/components/ui";
import { ThemeStamp } from "@/components/theme/ThemeStamp";
import { CaptureSheet } from "@/components/capture/CaptureSheet";
import type { Theme } from "@/lib/types";
import { SideRail } from "./SideRail";
import { TopBar } from "./TopBar";
import { BottomTabBar } from "./BottomTabBar";

export function AppShell({
  appName,
  userName,
  theme,
  defaultFunderId,
  children,
}: {
  appName: string;
  userName: string;
  theme: Theme;
  defaultFunderId: string | null;
  children: ReactNode;
}) {
  const [captureOpen, setCaptureOpen] = useState(false);
  // Bumped on every open so the sheet remounts with an empty draft.
  const [captureKey, setCaptureKey] = useState(0);

  function openCapture() {
    setCaptureKey((n) => n + 1);
    setCaptureOpen(true);
  }

  return (
    <ToastProvider>
      <ThemeStamp theme={theme} />
      <div className="flex min-h-screen w-full">
        <SideRail appName={appName} onOpenCapture={openCapture} />
        <div className="flex min-w-0 flex-1 flex-col">
          {/* DESIGN.md §5.3: the band sits directly below the status bar on
              every screen, and again directly above the tab bar. */}
          <KangaBand />
          <TopBar appName={appName} userName={userName} theme={theme} />
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-3 md:px-8 md:pb-10">
            {children}
          </main>
        </div>
      </div>
      <BottomTabBar onOpenCapture={openCapture} />
      <CaptureSheet
        key={captureKey}
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        defaultFunderId={defaultFunderId}
      />
    </ToastProvider>
  );
}
