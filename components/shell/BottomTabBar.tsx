"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { KangaBand } from "@/components/ui";
import { HomeIcon, MoneyIcon, PlusIcon, PlanIcon, AskIcon } from "./icons";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/money", label: "Money", Icon: MoneyIcon },
  { href: "/plan", label: "Plan", Icon: PlanIcon },
  { href: "/ask", label: "Ask", Icon: AskIcon },
] as const;

export function BottomTabBar({ onOpenCapture }: { onOpenCapture: () => void }) {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <KangaBand />
      <nav
        className="relative flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]"
        style={{ background: "var(--tabbar-bg)" }}
        aria-label="Primary"
      >
        {TABS.slice(0, 2).map((tab) => (
          <TabLink key={tab.href} {...tab} active={pathname === tab.href} />
        ))}

        <div className="relative flex w-16 items-center justify-center">
          <button
            onClick={onOpenCapture}
            aria-label="Add expense"
            className="focus-ring absolute -top-[18px] flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 border-ink bg-highlight text-ink shadow-sheet"
          >
            <PlusIcon width={24} height={24} />
          </button>
        </div>

        {TABS.slice(2).map((tab) => (
          <TabLink key={tab.href} {...tab} active={pathname === tab.href} />
        ))}
      </nav>
    </div>
  );
}

function TabLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: typeof HomeIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "focus-ring flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
        active ? "opacity-100" : "opacity-70"
      )}
      style={{ color: active ? "var(--tabbar-fg-active)" : "var(--tabbar-fg)" }}
    >
      <Icon width={20} height={20} />
      {label}
    </Link>
  );
}
