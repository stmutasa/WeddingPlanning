"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { useCatalog, useMe, useWedding } from "@/lib/hooks";
import { weddingCountdown, relativeShort, shortDate, dueLabel, dueTone } from "@/lib/dates";
import { percent } from "@/lib/money/cents";
import { formatUSD } from "@/lib/money/format";
import type {
  ActivityDto,
  BudgetSummaryDto,
  DigestDto,
  ExpenseListDto,
  PaymentDueDto,
  TransactionDto,
} from "@/lib/api-types";
import {
  Button,
  Card,
  EmptyState,
  JinaStrip,
  KangaBand,
  Money,
  SectionLabel,
  StackedBar,
} from "@/components/ui";
import {
  CardSkeleton,
  EventChip,
  EventRow,
  MoneyRow,
  PersonChip,
  RowsSkeleton,
  hueForFunder,
  hueForUser,
} from "@/components/common";
import { MarkPaidSheet } from "@/components/money/MarkPaidSheet";

const DISMISSED_KEY = "harusi:digest-dismissed";

/** Home (DESIGN.md §6, items 1–7); the reference render is lookbook direction B. */
export function HomeScreen({
  appName,
  defaultFunderId,
}: {
  appName: string;
  defaultFunderId: string | null;
}) {
  const router = useRouter();
  const { wedding } = useWedding();
  const { me } = useMe();
  const catalog = useCatalog();
  const summary = useSWR<BudgetSummaryDto>("/api/budget/summary", fetcher);
  const payments = useSWR<PaymentDueDto[]>("/api/payments?status=OPEN&days=14", fetcher);
  const inbox = useSWR<TransactionDto[]>("/api/transactions?status=NEW", fetcher);
  const activity = useSWR<ActivityDto[]>("/api/activity?n=8", fetcher);
  const expenses = useSWR<ExpenseListDto>("/api/expenses", fetcher);
  const digest = useSWR<{ digest: DigestDto | null }>("/api/digest", fetcher);

  const [paying, setPaying] = useState<PaymentDueDto | null>(null);
  // Read once at mount. The digest card only renders after its fetch
  // resolves, which is client-side, so the server and the first client
  // render agree either way; a blocked store simply shows the card.
  const [dismissed, setDismissed] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(DISMISSED_KEY);
    } catch {
      return null;
    }
  });

  const tz = me?.timezone;
  const countdown = wedding ? weddingCountdown(wedding) : { label: "", days: null, months: 0 };
  const spentPct = summary.data
    ? percent(summary.data.paidCents + summary.data.committedCents, summary.data.totalCents)
    : 0;
  const nextPayment = payments.data?.[0];
  const digestContent = digest.data?.digest ?? null;
  const showDigest = digestContent && digestContent.generatedAt !== dismissed;

  function dismissDigest() {
    if (!digestContent) return;
    setDismissed(digestContent.generatedAt);
    try {
      window.localStorage.setItem(DISMISSED_KEY, digestContent.generatedAt);
    } catch {
      // Nothing to do — the card reappears next visit, which is harmless.
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <JinaStrip />

      <header className="flex flex-col gap-0.5">
        <h1 className="wordmark text-[28px] leading-none text-ink">{appName}</h1>
        <p className="text-sm text-ink-soft">
          {wedding ? `${countdown.label} · ${wedding.city}` : "Loading…"}
        </p>
      </header>

      {inbox.data && inbox.data.length > 0 ? (
        <Link
          href="/money?tab=inbox"
          className="focus-ring flex min-h-11 items-center justify-between gap-2 rounded-lg border-[1.5px] border-warn px-3 py-2 text-[13px] font-semibold text-warn"
        >
          <span>
            {inbox.data.length} bank {inbox.data.length === 1 ? "row" : "rows"} waiting in the inbox
          </span>
          <span aria-hidden>→</span>
        </Link>
      ) : null}

      {showDigest && digestContent ? (
        <Card>
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <SectionLabel>This week</SectionLabel>
              <p className="font-display text-[15px] font-bold text-ink">
                {digestContent.headline}
              </p>
            </div>
            <button
              onClick={dismissDigest}
              className="focus-ring -mr-2 -mt-2 min-h-11 px-2 text-sm text-ink-soft"
              aria-label="Dismiss this week's digest"
            >
              ✕
            </button>
          </div>
          <ul className="flex flex-col gap-1 text-sm text-ink-soft">
            {digestContent.body.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {summary.data ? (
        <Link href="/money" className="focus-ring block">
          <Card variant="budget">
            <p className="label-tracked mb-2 opacity-80">
              Remaining of {formatUSD(summary.data.totalCents)}
            </p>
            <p className="flex items-baseline gap-2">
              <Money cents={summary.data.remainingCents} size="big" />
              <span className="text-[13px] opacity-80">· {spentPct}% spent</span>
            </p>
            <StackedBar
              className="mt-3"
              paidCents={summary.data.paidCents}
              committedCents={summary.data.committedCents}
              totalCents={summary.data.totalCents}
              colorVar="highlight"
            />
            <p className="mt-3 text-[13px] opacity-85">
              {countdown.months} {countdown.months === 1 ? "month" : "months"} to go
              {nextPayment
                ? ` · next payment: ${nextPayment.vendor?.name ?? "vendor"} ${formatUSD(nextPayment.amountCents)} on ${shortDate(nextPayment.dueDate, tz)}`
                : " · no scheduled payments"}
            </p>
          </Card>
        </Link>
      ) : (
        <CardSkeleton />
      )}

      {summary.data ? (
        <Card>
          <SectionLabel>By event</SectionLabel>
          <div className="flex flex-col">
            {summary.data.envelopes.map((envelope) => (
              <EventRow
                key={envelope.eventId}
                envelope={envelope}
                onClick={() => router.push(`/money?event=${envelope.eventSlug}`)}
              />
            ))}
          </div>
        </Card>
      ) : (
        <RowsSkeleton rows={4} title />
      )}

      <Card>
        <SectionLabel>Next payments · 14 days</SectionLabel>
        {!payments.data ? (
          <RowsSkeleton rows={2} />
        ) : payments.data.length === 0 ? (
          <p className="py-2 text-sm text-ink-soft">Nothing due in the next two weeks.</p>
        ) : (
          <div className="flex flex-col">
            {payments.data.slice(0, 5).map((payment) => (
              <MoneyRow
                key={payment.id}
                title={`${payment.vendor?.name ?? "Vendor"} · ${payment.label}`}
                amountCents={payment.amountCents}
                tone={dueTone(payment.dueDate) === "danger" ? "danger" : undefined}
                meta={<span>{dueLabel(payment.dueDate, tz)}</span>}
                right={
                  <Button size="sm" variant="secondary" onClick={() => setPaying(payment)}>
                    Mark paid
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionLabel>Recent</SectionLabel>
        {!expenses.data ? (
          <RowsSkeleton rows={3} />
        ) : expenses.data.expenses.length === 0 ? (
          <EmptyState
            title="No expenses yet"
            description="Tap ＋ to add the first one — type it, photograph the receipt, or fill the form."
          />
        ) : (
          <div className="flex flex-col">
            {expenses.data.expenses.slice(0, 5).map((expense) => (
              <MoneyRow
                key={expense.id}
                title={expense.description}
                amountCents={expense.amountCents}
                meta={
                  <>
                    <EventChip slug={expense.event.slug} name={expense.event.name} />
                    <span>{shortDate(expense.date, tz)}</span>
                    <PersonChip
                      name={expense.funder.name}
                      hue={hueForFunder(expense.funder, catalog.people)}
                    />
                  </>
                }
                onClick={() => router.push(`/money?expense=${expense.id}`)}
              />
            ))}
          </div>
        )}
      </Card>

      <div className="mt-2">
        <KangaBand className="mb-3" />
        <SectionLabel>Recent activity</SectionLabel>
        {!activity.data ? (
          <RowsSkeleton rows={3} />
        ) : activity.data.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing has happened yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activity.data.map((row) => {
              const hue = hueForUser(row.userId, catalog.people);
              return (
                <li key={row.id} className="flex items-baseline gap-2 text-sm text-ink">
                  <span className="flex-1">
                    <PersonChip
                      name={row.user?.settings?.displayName ?? row.user?.name ?? "Someone"}
                      hue={hue}
                      className="mr-1 align-middle"
                    />
                    {row.summary}
                  </span>
                  <span className="shrink-0 text-xs text-ink-soft">
                    {relativeShort(row.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <MarkPaidSheet
        payment={paying}
        defaultFunderId={defaultFunderId}
        onClose={() => setPaying(null)}
      />
    </div>
  );
}
