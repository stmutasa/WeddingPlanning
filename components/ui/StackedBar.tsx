import { clsx } from "@/lib/clsx";

export interface StackedBarProps {
  paidCents: number;
  committedCents: number;
  /** Envelope / budget total this bar is measured against. */
  totalCents: number;
  /** CSS variable name (without --), e.g. "highlight" or "ev-wedding". */
  colorVar?: string;
  height?: number;
  className?: string;
}

/**
 * Shared stacked bar (DESIGN.md §5.4): paid solid, committed hatched, the
 * rest of the envelope left as the sunken track. Used by BudgetCard,
 * EventRow, the Budget tab, and the Brief page's summary.
 */
export function StackedBar({
  paidCents,
  committedCents,
  totalCents,
  colorVar = "highlight",
  height = 8,
  className,
}: StackedBarProps) {
  const safeTotal = Math.max(totalCents, paidCents + committedCents, 1);
  const paidPct = clampPct((paidCents / safeTotal) * 100);
  const committedPct = clampPct((committedCents / safeTotal) * 100, 100 - paidPct);
  const color = `var(--${colorVar})`;

  return (
    <div
      className={clsx("w-full overflow-hidden rounded-full bg-sunken", className)}
      style={{ height }}
      role="img"
      aria-label={`Paid ${paidPct.toFixed(0)}%, committed ${committedPct.toFixed(0)}%`}
    >
      <div className="flex h-full w-full">
        <div style={{ width: `${paidPct}%`, backgroundColor: color }} />
        <div
          className="hatch-committed"
          style={{ width: `${committedPct}%`, color }}
        />
      </div>
    </div>
  );
}

function clampPct(value: number, max = 100): number {
  return Math.max(0, Math.min(max, value));
}
