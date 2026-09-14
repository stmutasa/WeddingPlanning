"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "@/lib/clsx";
import type { Theme } from "@/lib/types";
import { signOutAction } from "@/lib/actions/auth-actions";
import {
  GuestsIcon,
  VendorsIcon,
  BriefIcon,
  SettingsIcon,
  ChevronDownIcon,
  SignOutIcon,
} from "./icons";

const THEME_CYCLE: Theme[] = ["system", "light", "dark"];

export function TopBar({
  appName,
  userName,
  theme,
}: {
  appName: string;
  userName: string;
  theme: Theme;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  // Home prints the wordmark at full size in the page itself, so the bar
  // does not repeat it there.
  const showWordmark = pathname !== "/";

  function cycleTheme() {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
    startTransition(async () => {
      await fetch("/api/settings/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
      router.refresh();
    });
  }

  return (
    <header className="flex items-center justify-between border-b border-line px-4 py-3 md:px-6">
      {showWordmark ? (
        <Link href="/" className="wordmark text-lg text-ink md:hidden">
          {appName}
        </Link>
      ) : (
        <span />
      )}
      <div className="hidden md:block" />

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="focus-ring flex min-h-11 items-center gap-2 rounded-full py-1 pl-1 pr-2"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <ChevronDownIcon className="text-ink-soft" />
        </button>

        {open ? (
          <>
            <button
              aria-label="Close menu"
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <div
              role="menu"
              className="card-frame absolute right-0 z-50 mt-2 w-56 rounded-lg bg-card p-1 shadow-sheet"
            >
              <MenuLink href="/guests" onClick={() => setOpen(false)}>
                <GuestsIcon width={18} height={18} /> Guests
              </MenuLink>
              <MenuLink href="/vendors" onClick={() => setOpen(false)}>
                <VendorsIcon width={18} height={18} /> Vendors
              </MenuLink>
              <MenuLink href="/brief" onClick={() => setOpen(false)}>
                <BriefIcon width={18} height={18} /> Brief
              </MenuLink>
              <MenuLink href="/settings" onClick={() => setOpen(false)}>
                <SettingsIcon width={18} height={18} /> Settings
              </MenuLink>
              <button
                onClick={cycleTheme}
                disabled={isPending}
                className={clsx(
                  "focus-ring flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-sm text-ink hover:bg-sunken"
                )}
              >
                <span>Theme</span>
                <span className="text-ink-soft capitalize">{theme}</span>
              </button>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="focus-ring flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-sunken"
                >
                  <SignOutIcon width={18} height={18} /> Sign out
                </button>
              </form>
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
}

function MenuLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="focus-ring flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm text-ink hover:bg-sunken"
    >
      {children}
    </Link>
  );
}
