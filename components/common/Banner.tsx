import type { ReactNode } from "react";
import { clsx } from "@/lib/clsx";

const TONES = {
  info: "border-line text-ink-soft",
  warn: "border-warn text-warn",
  danger: "border-danger text-danger",
  ok: "border-ok text-ok",
} as const;

/** A one-line outlined notice: warnings, AI problems, offline hints. */
export function Banner({
  tone = "info",
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={clsx(
        "rounded-lg border-[1.5px] px-3 py-2 text-[13px] leading-snug",
        TONES[tone],
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * A neutral outlined badge for non-semantic states (vendor stage, note
 * kind). Semantic pills stay reserved for ok / at risk / over, so a vendor
 * that is merely "Considering" borrows no meaning it has not earned.
 */
export function NeutralBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border-[1.5px] border-line px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}
