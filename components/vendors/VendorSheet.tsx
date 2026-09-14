"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  apiDelete,
  apiPatch,
  apiPost,
  apiPut,
  apiUpload,
  centsToInput,
  dollarsToCents,
  fetcher,
} from "@/lib/api";
import { useCatalog, useMe, useRefreshAll } from "@/lib/hooks";
import { dayInput, dueLabel } from "@/lib/dates";
import { formatUSD } from "@/lib/money/format";
import {
  isDisabled,
  type ContractSummaryDto,
  type MaybeDisabled,
  type VendorDetailDto,
} from "@/lib/api-types";
import { VENDOR_STATUSES } from "@/lib/types";
import {
  Button,
  Card,
  Input,
  SectionLabel,
  Select,
  Sheet,
  Skeleton,
  Textarea,
  useToast,
} from "@/components/ui";
import { Banner, ConfirmDialog } from "@/components/common";

interface ScheduleRow {
  label: string;
  dueDate: string;
  amount: string;
}

/**
 * Vendor detail (DESIGN.md §6 Money › Vendors): contacts you can tap,
 * the payment schedule editor, attachments, and "Summarise contract"
 * (PROMPTS.md §9) with an "Apply schedule" step after review.
 */
export function VendorSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, mutate } = useSWR<VendorDetailDto>(id ? `/api/vendors/${id}` : null, fetcher);

  return (
    <Sheet
      open={Boolean(id)}
      onClose={onClose}
      title={data?.name ?? "Vendor"}
      className="max-h-[92vh] overflow-y-auto"
    >
      {!data ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        // Keyed by the vendor, so the schedule editor starts from that
        // vendor's instalments without an effect syncing state.
        <VendorBody key={data.id} vendor={data} mutate={mutate} onClose={onClose} />
      )}
    </Sheet>
  );
}

function VendorBody({
  vendor: data,
  mutate,
  onClose,
}: {
  vendor: VendorDetailDto;
  mutate: () => Promise<unknown>;
  onClose: () => void;
}) {
  const id = data.id;
  const catalog = useCatalog();
  const { me } = useMe();
  const { toast } = useToast();
  const refreshAll = useRefreshAll();

  const [rows, setRows] = useState<ScheduleRow[]>(() =>
    data.payments
      .filter((p) => p.status === "OPEN")
      .map((p) => ({
        label: p.label,
        dueDate: dayInput(p.dueDate),
        amount: centsToInput(p.amountCents),
      })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ContractSummaryDto | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [aiOff, setAiOff] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notes, setNotes] = useState(data.notes ?? "");

  async function patchVendor(patch: Record<string, unknown>) {
    if (!id) return;
    try {
      await apiPatch(`/api/vendors/${id}`, patch);
      await mutate();
      refreshAll();
      toast("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that");
    }
  }

  async function saveSchedule() {
    if (!id) return;
    setSaving(true);
    try {
      const items = rows
        .filter((row) => row.label.trim() && row.dueDate && row.amount.trim())
        .map((row) => ({
          label: row.label.trim(),
          dueDate: row.dueDate,
          amountCents: dollarsToCents(row.amount),
        }));
      await apiPut(`/api/vendors/${id}/payments`, { items });
      toast(
        `Schedule saved · ${items.length} ${items.length === 1 ? "instalment" : "instalments"}`,
      );
      await mutate();
      refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the schedule");
    } finally {
      setSaving(false);
    }
  }

  async function summarise(attachmentId: string) {
    setReading(attachmentId);
    setError(null);
    try {
      const result = await apiPost<MaybeDisabled<ContractSummaryDto>>("/api/ai/contract", {
        attachmentId,
        save: true,
      });
      if (isDisabled(result)) {
        setAiOff(true);
        return;
      }
      setSummary(result);
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That document could not be read");
    } finally {
      setReading(null);
    }
  }

  function applySummarySchedule() {
    if (!summary) return;
    setRows(
      summary.schedule
        .filter((item) => item.dueDate)
        .map((item) => ({
          label: item.label || "Instalment",
          dueDate: item.dueDate as string,
          amount: item.amount != null ? String(item.amount) : "",
        })),
    );
    setSummary(null);
    toast("Schedule filled in — check it, then save");
  }

  async function uploadAttachment(file: File) {
    if (!id) return;
    const form = new FormData();
    form.append("file", file);
    form.append("kind", "CONTRACT");
    await apiUpload(`/api/vendors/${id}/attachments`, form);
    await mutate();
    toast("Attached");
  }

  async function removeVendor() {
    if (!id) return;
    setSaving(true);
    try {
      await apiDelete(`/api/vendors/${id}`);
      toast("Vendor deleted");
      refreshAll();
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that vendor");
    } finally {
      setSaving(false);
    }
  }

  const paidCents = data?.expenses.reduce((total, e) => total + e.amountCents, 0) ?? 0;

  return (
    <>
      <div className="flex flex-col gap-4">
        {error ? <Banner tone="danger">{error}</Banner> : null}

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Stage"
            value={data.status}
            onChange={(e) => patchVendor({ status: e.target.value })}
          >
            {VENDOR_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.toLowerCase()}
              </option>
            ))}
          </Select>
          <Select
            label="Event"
            value={data.eventId ?? ""}
            onChange={(e) => patchVendor({ eventId: e.target.value || null })}
          >
            <option value="">No event</option>
            {catalog.events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-ink-soft">
          <span>
            Quoted{" "}
            <span className="font-semibold text-ink">
              {data.quotedCents != null ? formatUSD(data.quotedCents) : "—"}
            </span>
          </span>
          <span>
            Paid <span className="font-semibold text-ink">{formatUSD(paidCents)}</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.phone ? (
            <ContactLink href={`tel:${data.phone.replace(/\s/g, "")}`}>Call</ContactLink>
          ) : null}
          {data.whatsapp ? (
            <ContactLink href={`https://wa.me/${data.whatsapp.replace(/[^\d]/g, "")}`}>
              WhatsApp
            </ContactLink>
          ) : null}
          {data.email ? <ContactLink href={`mailto:${data.email}`}>Email</ContactLink> : null}
          {data.website ? <ContactLink href={data.website}>Website</ContactLink> : null}
          {!data.phone && !data.whatsapp && !data.email && !data.website ? (
            <p className="text-sm text-ink-soft">No contact details yet.</p>
          ) : null}
        </div>

        <div>
          <SectionLabel>Payment schedule</SectionLabel>
          <div className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-[1fr_auto] gap-2">
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    label="Label"
                    value={row.label}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)),
                      )
                    }
                  />
                  <Input
                    label="Due"
                    type="date"
                    value={row.dueDate}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, dueDate: e.target.value } : r)),
                      )
                    }
                  />
                  <Input
                    label="USD"
                    inputMode="decimal"
                    value={row.amount}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, amount: e.target.value } : r)),
                      )
                    }
                  />
                </div>
                <button
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                  className="focus-ring mt-5 min-h-11 px-2 text-xs font-semibold uppercase text-danger"
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setRows((prev) => [...prev, { label: "Instalment", dueDate: "", amount: "" }])
                }
              >
                Add instalment
              </Button>
              <Button size="sm" onClick={saveSchedule} disabled={saving}>
                {saving ? "Saving…" : "Save schedule"}
              </Button>
            </div>
            {data.payments.filter((p) => p.status === "PAID").length > 0 ? (
              <ul className="flex flex-col gap-1 text-xs text-ink-soft">
                {data.payments
                  .filter((p) => p.status === "PAID")
                  .map((p) => (
                    <li key={p.id}>
                      Paid · {p.label} · {formatUSD(p.amountCents)}
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div>
          <SectionLabel>Attachments</SectionLabel>
          {data.attachments.length === 0 ? (
            <p className="mb-2 text-sm text-ink-soft">No contract or quote attached yet.</p>
          ) : (
            <ul className="mb-2 flex flex-col gap-2">
              {data.attachments.map((attachment) => (
                <li key={attachment.id} className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/api/attachments/${attachment.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring min-h-11 flex-1 truncate py-2 text-sm text-primary underline"
                  >
                    {attachment.kind.toLowerCase()} · {Math.round(attachment.bytes / 1024)} KB
                  </a>
                  {!aiOff ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={reading === attachment.id}
                      onClick={() => summarise(attachment.id)}
                    >
                      {reading === attachment.id ? "Reading…" : "Summarise contract"}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await uploadAttachment(file);
              e.target.value = "";
            }}
            className="focus-ring min-h-11 w-full rounded-lg bg-sunken px-3 py-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-wide file:text-on-primary"
          />
        </div>

        {data.contractSummary ? (
          <Card>
            <SectionLabel>Contract summary</SectionLabel>
            <p className="text-sm text-ink">{data.contractSummary}</p>
          </Card>
        ) : null}

        <Textarea
          label="Notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (data.notes ?? "") && patchVendor({ notes: notes || null })}
        />

        {data.payments.filter((p) => p.status === "OPEN").length > 0 ? (
          <p className="text-xs text-ink-soft">
            Next due:{" "}
            {dueLabel(data.payments.filter((p) => p.status === "OPEN")[0].dueDate, me?.timezone)}
          </p>
        ) : null}

        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          Delete vendor
        </Button>
      </div>

      <Sheet
        open={Boolean(summary)}
        onClose={() => setSummary(null)}
        title="Contract summary"
        className="max-h-[92vh] overflow-y-auto"
      >
        {summary ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink">{summary.summary}</p>
            {summary.totalAmount != null ? (
              <p className="text-sm text-ink-soft">
                Total as printed: {summary.currency ?? ""} {summary.totalAmount}
              </p>
            ) : null}
            {summary.schedule.length > 0 ? (
              <div>
                <p className="label-tracked mb-2">Instalments</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {summary.schedule.map((item, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="text-ink-soft">
                        {item.label} {item.dueDate ? `· ${item.dueDate}` : ""}
                      </span>
                      <span className="tabular-nums text-ink">{item.amount ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {summary.redFlags.length > 0 ? (
              <div className="flex flex-col gap-2">
                {summary.redFlags.map((flag, i) => (
                  <Banner key={i} tone="warn">
                    {flag}
                  </Banner>
                ))}
              </div>
            ) : null}
            {summary.questionsToAsk.length > 0 ? (
              <div>
                <p className="label-tracked mb-2">Questions to ask</p>
                <ul className="list-disc pl-5 text-sm text-ink-soft">
                  {summary.questionsToAsk.map((question, i) => (
                    <li key={i}>{question}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {summary.cancellationTerms ? (
              <p className="text-sm text-ink-soft">Cancellation: {summary.cancellationTerms}</p>
            ) : null}
            <Button onClick={applySummarySchedule} disabled={summary.schedule.length === 0}>
              Apply schedule
            </Button>
          </div>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this vendor?"
        body="Their payment schedule goes too. Expenses already recorded stay."
        confirmLabel="Delete"
        danger
        busy={saving}
        onConfirm={removeVendor}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}

function ContactLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className="focus-ring inline-flex min-h-11 items-center rounded-lg border-2 border-ink px-4 text-[13px] font-bold uppercase tracking-[0.06em] text-ink"
    >
      {children}
    </a>
  );
}
