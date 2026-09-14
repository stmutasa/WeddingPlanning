import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/shell/AppShell";
import type { Theme } from "@/lib/types";

const appName = process.env.APP_NAME ?? "Harusi";

// A route-group layout ((app)) has no URL segment of its own, so Next's
// generated `LayoutProps<...>` (which only covers real segments) doesn't
// apply here — plain children works for every route group layout below.
export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [settings, funder] = await Promise.all([
    db.userSettings.findUnique({ where: { userId: session.user.id } }),
    db.funder.findUnique({ where: { userId: session.user.id } }),
  ]);

  const userName = settings?.displayName ?? session.user.name ?? session.user.email ?? "You";
  const theme = (settings?.theme ?? "system") as Theme;

  return (
    <AppShell
      appName={appName}
      userName={userName}
      theme={theme}
      defaultFunderId={funder?.id ?? null}
    >
      {children}
    </AppShell>
  );
}
