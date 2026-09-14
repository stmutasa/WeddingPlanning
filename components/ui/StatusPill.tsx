import type { ReactNode } from "react";
import { clsx } from "@/lib/clsx";

export type SemanticStatus = "ok" | "warn" | "danger";

const STATUS_CLASSES: Record<SemanticStatus, string> = {
  ok: "border-ok text-ok",
  warn: "border-warn text-warn",
  danger: "border-danger text-danger",
};

const STATUS_GLYPH: Record<SemanticStatus, string> = {
  ok: "✓", // check
  warn: "!",
  danger: "×", // multiplication sign, reads as an X
};

export interface StatusPillProps {
  status: SemanticStatus;
  children: ReactNode;
  className?: string;
}

/** Outlined semantic pill (never filled) with a glyph, per DESIGN.md §5.1. */
export function StatusPill({ status, children, className }: StatusPillProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border-[1.5px] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
        STATUS_CLASSES[status],
        className
      )}
    >
      <span aria-hidden>{STATUS_GLYPH[status]}</span>
      {children}
    </span>
  );
}
