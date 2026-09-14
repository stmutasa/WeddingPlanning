import { clsx } from "@/lib/clsx";
import { formatUSD, formatUSDSigned, formatKESSecondary } from "@/lib/money/format";

export interface MoneyProps {
  cents: number;
  /** "big" = home/budget headline; "row" = list rows (default). */
  size?: "big" | "row";
  detail?: boolean;
  signed?: boolean;
  /** Shows a secondary "≈ KES ..." line under the amount. */
  kesRate?: number;
  className?: string;
}

/** Formats integer-cent amounts per DESIGN.md §5.2 (tabular-nums, big/row scale). */
export function Money({ cents, size = "row", detail, signed, kesRate, className }: MoneyProps) {
  const text = signed ? formatUSDSigned(cents, { detail }) : formatUSD(cents, { detail });
  return (
    <span className={clsx("inline-flex flex-col", className)}>
      <span
        className={clsx(
          "font-body tabular-nums",
          size === "big" ? "text-[36px] font-bold tracking-[-0.02em]" : "text-sm font-semibold"
        )}
      >
        {text}
      </span>
      {kesRate ? (
        <span className="text-xs text-ink-soft tabular-nums">
          {formatKESSecondary(cents, kesRate)}
        </span>
      ) : null}
    </span>
  );
}
