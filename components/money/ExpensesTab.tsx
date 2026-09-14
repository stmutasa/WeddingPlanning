"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { useCatalog, useMe } from "@/lib/hooks";
import { shortDate } from "@/lib/dates";
import type { ExpenseListDto } from "@/lib/api-types";
import { Card, EmptyState, Input, Money, SectionLabel, Select } from "@/components/ui";
import { EventChip, MoneyRow, PersonChip, RowsSkeleton, hueForFunder } from "@/components/common";
import { ExpenseSheet } from "./ExpenseSheet";

/** Money › Expenses: list, filters, totals, search, tap-through to the detail sheet. */
export function ExpensesTab({
  eventSlug,
  openExpenseId,
  onOpenExpense,
}: {
  eventSlug?: string;
  openExpenseId: string | null;
  onOpenExpense: (id: string | null) => void;
}) {
  const catalog = useCatalog();
  const { me } = useMe();
  const [q, setQ] = useState("");
  const [eventId, setEventId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [funderId, setFunderId] = useState("");

  const slugEvent = catalog.events.find((e) => e.slug === eventSlug);
  const activeEventId = eventId || slugEvent?.id || "";

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (activeEventId) params.set("eventId", activeEventId);
    if (categoryId) params.set("categoryId", categoryId);
    if (funderId) params.set("funderId", funderId);
    if (q.trim()) params.set("q", q.trim());
    const search = params.toString();
    return `/api/expenses${search ? `?${search}` : ""}`;
  }, [activeEventId, categoryId, funderId, q]);

  const { data } = useSWR<ExpenseListDto>(query, fetcher);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <SectionLabel>Filters</SectionLabel>
        <div className="flex flex-col gap-3">
          <Input
            label="Search"
            placeholder="Florist, deposit, vendor…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              label="Event"
              value={activeEventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              <option value="">All events</option>
              {catalog.events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </Select>
            <Select
              label="Category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">All categories</option>
              {catalog.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select label="Paid by" value={funderId} onChange={(e) => setFunderId(e.target.value)}>
              <option value="">Anyone</option>
              {catalog.funders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {!data ? (
        <RowsSkeleton rows={5} title />
      ) : (
        <Card>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <SectionLabel>
              {data.count} {data.count === 1 ? "expense" : "expenses"}
            </SectionLabel>
            <Money cents={data.totalCents} />
          </div>
          {data.expenses.length === 0 ? (
            <EmptyState
              title="No expenses match"
              description="Clear a filter, or tap ＋ to add one."
            />
          ) : (
            <div className="flex flex-col">
              {data.expenses.map((expense) => (
                <MoneyRow
                  key={expense.id}
                  title={expense.description}
                  amountCents={expense.amountCents}
                  onClick={() => onOpenExpense(expense.id)}
                  meta={
                    <>
                      <EventChip slug={expense.event.slug} name={expense.event.name} />
                      <span>{shortDate(expense.date, me?.timezone)}</span>
                      <PersonChip
                        name={expense.funder.name}
                        hue={hueForFunder(expense.funder, catalog.people)}
                      />
                      {expense.vendor ? <span>· {expense.vendor.name}</span> : null}
                    </>
                  }
                />
              ))}
            </div>
          )}
        </Card>
      )}

      <ExpenseSheet id={openExpenseId} onClose={() => onOpenExpense(null)} />
    </div>
  );
}
