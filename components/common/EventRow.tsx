import { clsx } from "@/lib/clsx";
import { Money, StackedBar } from "@/components/ui";
import type { BudgetEnvelopeDto } from "@/lib/api-types";
import { asEventSlug } from "./attribution";
import { ForecastPill } from "./ForecastPill";

/**
 * DESIGN.md §5.4 EventRow: event dot + name, paid / envelope in row money,
 * a 5px stacked mini-bar (paid solid, committed hatched) and the outlined
 * status pill at the right.
 */
export function EventRow({
  envelope,
  onClick,
  className,
}: {
  envelope: BudgetEnvelopeDto;
  onClick?: () => void;
  className?: string;
}) {
  const slug = asEventSlug(envelope.eventSlug);
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: `var(--ev-${slug})` }}
          />
          <span className="truncate text-[14px] font-semibold text-ink">{envelope.eventName}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-ink-soft">
            <Money cents={envelope.paidCents} />
          </span>
          <span className="text-xs text-ink-soft">/</span>
          <span className="text-ink-soft">
            <Money cents={envelope.budgetCents} />
          </span>
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <StackedBar
          className="flex-1"
          height={5}
          colorVar={`ev-${slug}`}
          paidCents={envelope.paidCents}
          committedCents={envelope.committedCents}
          totalCents={envelope.budgetCents}
        />
        <ForecastPill status={envelope.status} />
      </div>
    </>
  );

  if (!onClick) return <div className={clsx("py-2", className)}>{content}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx("focus-ring w-full min-h-11 py-2 text-left", className)}
    >
      {content}
    </button>
  );
}
