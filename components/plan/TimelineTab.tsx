"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { useMe, useWedding } from "@/lib/hooks";
import { addMonths, dayInput, monthLabel, shortDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money/format";
import type { PaymentDueDto, TaskDto } from "@/lib/api-types";
import { Card, EmptyState, SectionLabel } from "@/components/ui";
import { CardSkeleton, EventChip, NeutralBadge } from "@/components/common";

/**
 * Plan › Timeline (DESIGN.md §6): a vertical month strip from this month to
 * the wedding month, with milestones and payment dues sitting on it.
 */
export function TimelineTab() {
  const { wedding } = useWedding();
  const { me } = useMe();
  const tasks = useSWR<TaskDto[]>("/api/tasks?status=OPEN", fetcher);
  const payments = useSWR<PaymentDueDto[]>("/api/payments?status=OPEN", fetcher);

  if (!wedding || !tasks.data || !payments.data) return <CardSkeleton />;

  const thisMonth = dayInput(new Date(), me?.timezone).slice(0, 7);
  const lastMonth = wedding.weddingDate
    ? dayInput(wedding.weddingDate, wedding.eventTimezone).slice(0, 7)
    : wedding.targetMonth;

  const months: string[] = [];
  let cursor = thisMonth;
  for (let i = 0; i < 60 && cursor <= lastMonth; i++) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  if (months.length === 0) months.push(thisMonth);

  const milestones = tasks.data.filter((task) => task.milestone && task.dueDate);
  const anything = milestones.length > 0 || payments.data.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {!anything ? (
        <EmptyState
          title="Nothing on the timeline yet"
          description="Milestone tasks and scheduled vendor payments appear here, month by month, up to the wedding."
        />
      ) : null}

      <ol className="flex flex-col">
        {months.map((month, index) => {
          const monthMilestones = milestones.filter(
            (task) => (task.dueDate ?? "").slice(0, 7) === month,
          );
          const monthPayments = payments.data!.filter(
            (payment) => payment.dueDate.slice(0, 7) === month,
          );
          const isCurrent = index === 0;
          const isWeddingMonth = month === lastMonth;

          return (
            <li key={month} className="flex gap-3">
              <div className="flex w-3 shrink-0 flex-col items-center">
                <span
                  aria-hidden
                  className="mt-3 h-3 w-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      isCurrent || isWeddingMonth ? "var(--highlight)" : "var(--line)",
                  }}
                />
                {index < months.length - 1 ? (
                  <span aria-hidden className="w-px flex-1 bg-line" />
                ) : null}
              </div>

              <div className="min-w-0 flex-1 pb-4">
                <p className="pt-2 text-[13px] font-semibold text-ink">
                  {monthLabel(month)}
                  {isCurrent ? " · now" : ""}
                  {isWeddingMonth ? " · the wedding" : ""}
                </p>

                {monthMilestones.length === 0 && monthPayments.length === 0 ? (
                  <p className="mt-1 text-xs text-ink-soft">Nothing scheduled.</p>
                ) : (
                  <Card className="mt-2 flex flex-col gap-2">
                    {monthMilestones.length > 0 ? (
                      <div>
                        <SectionLabel>Milestones</SectionLabel>
                        <ul className="flex flex-col gap-1">
                          {monthMilestones.map((task) => (
                            <li
                              key={task.id}
                              className="flex flex-wrap items-center gap-2 text-sm text-ink"
                            >
                              <span>{task.title}</span>
                              {task.event ? (
                                <EventChip slug={task.event.slug} name={task.event.name} />
                              ) : null}
                              <span className="text-xs text-ink-soft">
                                {task.dueDate ? shortDate(task.dueDate, me?.timezone) : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {monthPayments.length > 0 ? (
                      <div>
                        <SectionLabel>Payments due</SectionLabel>
                        <ul className="flex flex-col gap-1">
                          {monthPayments.map((payment) => (
                            <li
                              key={payment.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span className="min-w-0 flex-1 truncate text-ink">
                                {payment.vendor?.name ?? "Vendor"} · {payment.label}
                              </span>
                              <span className="shrink-0 tabular-nums text-ink-soft">
                                {formatUSD(payment.amountCents)} ·{" "}
                                {shortDate(payment.dueDate, me?.timezone)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </Card>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-ink-soft">
        <NeutralBadge>note</NeutralBadge> Months run in {wedding.eventTimezone.replace("_", " ")}{" "}
        for the wedding date, and in your own zone for everything else.
      </p>
    </div>
  );
}
