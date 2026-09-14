"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { dueLabel, dueTone } from "@/lib/dates";
import { formatUSD } from "@/lib/money/format";
import type { PaymentDueDto } from "@/lib/api-types";
import { Button, Card, EmptyState, Money, SectionLabel, Tabs } from "@/components/ui";
import { EventChip, MoneyRow, RowsSkeleton } from "@/components/common";
import { MarkPaidSheet } from "./MarkPaidSheet";

/** Money › Payments: every OPEN instalment by due date, overdue in danger. */
export function PaymentsTab({ defaultFunderId }: { defaultFunderId: string | null }) {
  const [status, setStatus] = useState("OPEN");
  const { data } = useSWR<PaymentDueDto[]>(`/api/payments?status=${status}`, fetcher);
  const { me } = useMe();
  const [paying, setPaying] = useState<PaymentDueDto | null>(null);

  const total = (data ?? []).reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={status}
        onChange={setStatus}
        items={[
          { value: "OPEN", label: "Open" },
          { value: "PAID", label: "Paid" },
          { value: "CANCELLED", label: "Cancelled" },
        ]}
      />

      {!data ? (
        <RowsSkeleton rows={4} title />
      ) : data.length === 0 ? (
        <EmptyState
          title={status === "OPEN" ? "Nothing is scheduled" : "Nothing here"}
          description="Payment schedules are set on each vendor, or read off a quote with the assistant."
        />
      ) : (
        <Card>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <SectionLabel>
              {data.length} {data.length === 1 ? "instalment" : "instalments"}
            </SectionLabel>
            <Money cents={total} />
          </div>
          <div className="flex flex-col">
            {data.map((payment) => {
              const tone = dueTone(payment.dueDate);
              return (
                <MoneyRow
                  key={payment.id}
                  title={`${payment.vendor?.name ?? "Vendor"} · ${payment.label}`}
                  amountCents={payment.amountCents}
                  tone={status === "OPEN" && tone === "danger" ? "danger" : undefined}
                  meta={
                    <>
                      {payment.vendor?.event ? (
                        <EventChip
                          slug={payment.vendor.event.slug}
                          name={payment.vendor.event.name}
                        />
                      ) : null}
                      <span
                        className={
                          tone === "danger" && status === "OPEN" ? "text-danger" : undefined
                        }
                      >
                        {dueLabel(payment.dueDate, me?.timezone)}
                      </span>
                    </>
                  }
                  right={
                    status === "OPEN" ? (
                      <Button size="sm" variant="secondary" onClick={() => setPaying(payment)}>
                        Mark paid
                      </Button>
                    ) : (
                      <span className="text-xs text-ink-soft">
                        {formatUSD(payment.amountCents)} · {payment.status.toLowerCase()}
                      </span>
                    )
                  }
                />
              );
            })}
          </div>
        </Card>
      )}

      <MarkPaidSheet
        payment={paying}
        defaultFunderId={defaultFunderId}
        onClose={() => setPaying(null)}
      />
    </div>
  );
}
