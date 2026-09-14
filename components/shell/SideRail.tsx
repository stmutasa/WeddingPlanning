"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { KangaBand } from "@/components/ui";
import { HomeIcon, MoneyIcon, PlusIcon, PlanIcon, AskIcon } from "./icons";

const NAV = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/money", label: "Money", Icon: MoneyIcon },
  { href: "/plan", label: "Plan", Icon: PlanIcon },
  { href: "/ask", label: "Ask", Icon: AskIcon },
] as const;

export function SideRail({
  onOpenCapture,
  appName,
}: {
  onOpenCapture: () => void;
  appName: string;
}) {
  const pathname = usePathname();

  return (
    <div className="relative hidden w-[220px] shrink-0 md:flex">
      <aside className="flex w-full flex-col gap-1 bg-primary p-4 text-on-primary">
        <Link href="/" className="wordmark mb-6 block px-2 text-2xl text-on-primary">
          {appName}
        </Link>

        <button
          onClick={onOpenCapture}
          className="focus-ring mb-4 flex items-center gap-2 rounded-lg border-2 border-on-primary/40 px-3 py-2.5 text-left text-[13px] font-bold uppercase tracking-wide text-on-primary"
        >
          <PlusIcon width={18} height={18} /> Add
        </button>

        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold",
                active ? "bg-highlight text-on-highlight" : "text-on-primary/80"
              )}
            >
              <Icon width={18} height={18} />
              {label}
            </Link>
          );
        })}
      </aside>
      <KangaBand orientation="vertical" className="absolute right-0 top-0" />
    </div>
  );
}
