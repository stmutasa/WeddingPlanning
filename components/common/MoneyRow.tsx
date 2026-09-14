import type { ReactNode } from "react";
import { clsx } from "@/lib/clsx";
import { Money } from "@/components/ui";

/**
 * DESIGN.md §5.4 MoneyRow: description in 600, amount right in tabular
 * numbers, and a second line of chips (event · date · person).
 */
export function MoneyRow({
  title,
  amountCents,
  meta,
  right,
  onClick,
  tone,
  className,
}: {
  title: ReactNode;
  amountCents: number;
  meta?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  tone?: "danger" | "ok";
  className?: string;
}) {
  const body = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <span className="min-w-0 flex-1 break-words text-[15px] font-semibold text-ink">
          {title}
        </span>
        <span
          className={clsx(
            "shrink-0 text-right",
            tone === "danger" && "text-danger",
            tone === "ok" && "text-ok",
          )}
        >
          <Money cents={amountCents} />
        </span>
      </div>
      {meta ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
          {meta}
        </div>
      ) : null}
      {right ? <div className="mt-2 flex flex-wrap items-center gap-2">{right}</div> : null}
    </>
  );

  if (!onClick) {
    return (
      <div className={clsx("border-t border-line py-3 first:border-t-0", className)}>{body}</div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "focus-ring w-full border-t border-line py-3 text-left first:border-t-0",
        className,
      )}
    >
      {body}
    </button>
  );
}
