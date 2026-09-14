"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";
import { useCatalog, useRefreshAll } from "@/lib/hooks";
import { centsToInput } from "@/lib/api";
import { emptyDraft, draftProblem, toBody, type ExpenseDraft } from "@/lib/expense-draft";
import { formatUSD } from "@/lib/money/format";
import type { PaymentDueDto } from "@/lib/api-types";
import { Button, Sheet, useToast } from "@/components/ui";
import { Banner } from "@/components/common";
import { ExpenseFields } from "@/components/capture/ExpenseFields";

/**
 * "Mark paid" from Home and from Money › Payments (DESIGN.md §6): the
 * expense sheet opens prefilled from the instalment, and POSTing it records
 * the expense and closes the PaymentDue in one transaction.
 */
export function MarkPaidSheet({
  payment,
  defaultFunderId,
  onClose,
}: {
  payment: PaymentDueDto | null;
  defaultFunderId: string | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={Boolean(payment)}
      onClose={onClose}
      title="Mark paid"
      className="max-h-[92vh] overflow-y-auto"
    >
      {payment ? (
        // Keyed by the instalment, so each one opens its own clean form.
        <MarkPaidBody
          key={payment.id}
          payment={payment}
          defaultFunderId={defaultFunderId}
          onClose={onClose}
        />
      ) : null}
    </Sheet>
  );
}

function MarkPaidBody({
  payment,
  defaultFunderId,
  onClose,
}: {
  payment: PaymentDueDto;
  defaultFunderId: string | null;
  onClose: () => void;
}) {
  const catalog = useCatalog();
  const { toast } = useToast();
  const refreshAll = useRefreshAll();
  const [draft, setDraft] = useState<ExpenseDraft>(() =>
    emptyDraft({
      description: `${payment.vendor?.name ?? "Vendor"} · ${payment.label}`,
      amount: centsToInput(payment.amountCents),
      eventId: payment.vendor?.eventId ?? "",
      categoryId: payment.vendor?.categoryId ?? "",
      vendorId: payment.vendorId,
      funderId: defaultFunderId ?? "",
    }),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const problem = draftProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      const body = toBody(draft, "MANUAL");
      await apiPost(`/api/payments/${payment.id}`, {
        description: body.description,
        amountCents: body.amountCents,
        originalAmount: body.originalAmount,
        originalCurrency: body.originalCurrency,
        fxRate: body.fxRate,
        date: body.date,
        eventId: body.eventId,
        categoryId: body.categoryId,
        funderId: body.funderId,
        notes: body.notes,
      });
      toast(`Paid · ${payment.vendor?.name ?? ""} · ${formatUSD(payment.amountCents)}`);
      refreshAll();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark that paid");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <ExpenseFields
        draft={draft}
        onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
        events={catalog.events}
        categories={catalog.categories}
        funders={catalog.funders}
        vendors={catalog.vendors}
      />
      <Button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Record the payment"}
      </Button>
    </div>
  );
}
