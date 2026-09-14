"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiDelete, apiPatch, apiUpload, centsToInput, fetcher } from "@/lib/api";
import { useCatalog, useMe, useRefreshAll } from "@/lib/hooks";
import { dayInput, longDate } from "@/lib/dates";
import { emptyDraft, draftProblem, toBody, type ExpenseDraft } from "@/lib/expense-draft";
import { formatOriginal } from "@/lib/money/format";
import type { AttachmentDto, ExpenseDto } from "@/lib/api-types";
import { Button, Money, Sheet, Skeleton, useToast } from "@/components/ui";
import { Banner, ConfirmDialog } from "@/components/common";
import { ExpenseFields } from "@/components/capture/ExpenseFields";

/** Expense detail / edit, with its attachments (DESIGN.md §6 Money › Expenses). */
export function ExpenseSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, mutate } = useSWR<ExpenseDto>(id ? `/api/expenses/${id}` : null, fetcher);

  return (
    <Sheet
      open={Boolean(id)}
      onClose={onClose}
      title={data?.description ?? "Expense"}
      className="max-h-[92vh] overflow-y-auto"
    >
      {!data ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        // Keyed by the row it is editing, so a different expense mounts a
        // fresh form instead of an effect copying props into state.
        <ExpenseBody key={data.id} expense={data} mutate={mutate} onClose={onClose} />
      )}
    </Sheet>
  );
}

function ExpenseBody({
  expense,
  mutate,
  onClose,
}: {
  expense: ExpenseDto;
  mutate: () => Promise<unknown>;
  onClose: () => void;
}) {
  const catalog = useCatalog();
  const { me } = useMe();
  const { toast } = useToast();
  const refreshAll = useRefreshAll();
  const [draft, setDraft] = useState<ExpenseDraft>(() =>
    emptyDraft({
      description: expense.description,
      amount:
        expense.originalAmount != null &&
        expense.originalCurrency &&
        expense.originalCurrency !== "USD"
          ? String(expense.originalAmount)
          : centsToInput(expense.amountCents),
      currency: expense.originalCurrency ?? "USD",
      fxRate: expense.fxRate != null ? String(expense.fxRate) : "",
      date: dayInput(expense.date),
      eventId: expense.eventId,
      categoryId: expense.categoryId ?? "",
      vendorId: expense.vendorId ?? "",
      funderId: expense.funderId,
      notes: expense.notes ?? "",
    }),
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const problem = draftProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await apiPatch(`/api/expenses/${expense.id}`, toBody(draft));
      toast("Saved");
      await mutate();
      refreshAll();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await apiDelete(`/api/expenses/${expense.id}`);
      toast("Deleted");
      refreshAll();
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that");
    } finally {
      setSaving(false);
    }
  }

  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    await apiUpload(`/api/expenses/${expense.id}/attachments`, form);
    await mutate();
    toast("Attached");
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <Banner tone="danger">{error}</Banner> : null}

      {editing ? (
        <>
          <ExpenseFields
            draft={draft}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
            events={catalog.events}
            categories={catalog.categories}
            funders={catalog.funders}
            vendors={catalog.vendors}
          />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div>
            <Money cents={expense.amountCents} size="big" detail />
            {expense.originalCurrency &&
            expense.originalCurrency !== "USD" &&
            expense.originalAmount ? (
              <p className="mt-1 text-sm text-ink-soft">
                {formatOriginal(expense.originalAmount, expense.originalCurrency)}
                {expense.fxRate ? ` at ${expense.fxRate} USD` : ""}
              </p>
            ) : null}
          </div>

          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Event" value={expense.event?.name ?? "—"} />
            <Row label="Date" value={longDate(expense.date, me?.timezone)} />
            <Row label="Category" value={expense.category?.name ?? "—"} />
            <Row label="Vendor" value={expense.vendor?.name ?? "—"} />
            <Row label="Paid by" value={expense.funder?.name ?? "—"} />
            <Row label="Source" value={expense.source} />
            {expense.notes ? <Row label="Notes" value={expense.notes} /> : null}
          </dl>

          <Attachments
            attachments={expense.attachments ?? []}
            onUpload={upload}
            onRemoved={async () => {
              await mutate();
            }}
          />

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this expense?"
        body="It disappears from the budget and the settle-up. This cannot be undone."
        confirmLabel="Delete"
        danger
        busy={saving}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-line pt-2 first:border-t-0 first:pt-0">
      <dt className="label-tracked">{label}</dt>
      <dd className="text-right text-sm text-ink">{value}</dd>
    </div>
  );
}

export function Attachments({
  attachments,
  onUpload,
  onRemoved,
}: {
  attachments: AttachmentDto[];
  onUpload: (file: File) => Promise<void>;
  onRemoved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function remove(attachmentId: string) {
    setBusy(true);
    try {
      await apiDelete(`/api/attachments/${attachmentId}`);
      await onRemoved();
      toast("Attachment removed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="label-tracked mb-2">Attachments</p>
      {attachments.length === 0 ? (
        <p className="mb-2 text-sm text-ink-soft">Nothing attached yet.</p>
      ) : (
        <ul className="mb-2 flex flex-col gap-1">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="flex items-center justify-between gap-2">
              <a
                href={`/api/attachments/${attachment.id}`}
                target="_blank"
                rel="noreferrer"
                className="focus-ring min-h-11 flex-1 truncate py-2 text-sm text-primary underline"
              >
                {attachment.kind.toLowerCase()} · {Math.round(attachment.bytes / 1024)} KB
              </a>
              <button
                onClick={() => remove(attachment.id)}
                disabled={busy}
                className="focus-ring min-h-11 px-2 text-xs font-semibold uppercase tracking-wide text-danger"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        type="file"
        accept="image/*,application/pdf"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            await onUpload(file);
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
        className="focus-ring min-h-11 w-full rounded-lg bg-sunken px-3 py-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-wide file:text-on-primary"
      />
    </div>
  );
}
