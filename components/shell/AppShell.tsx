"use client";

import { useState, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui";
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

  return (
    <ToastProvider>
      <ThemeStamp theme={theme} />
      <div className="flex min-h-screen w-full">
        <SideRail appName={appName} onOpenCapture={() => setCaptureOpen(true)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar appName={appName} userName={userName} theme={theme} />
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-2 md:px-8 md:pb-10">
            {children}
          </main>
        </div>
      </div>
      <BottomTabBar onOpenCapture={() => setCaptureOpen(true)} />
      <CaptureSheet
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        defaultFunderId={defaultFunderId}
      />
    </ToastProvider>
  );
}
