"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiPost, fetcher } from "@/lib/api";
import { useCatalog, useMe, useRefreshAll } from "@/lib/hooks";
import { shortDate } from "@/lib/dates";
import type { TransactionDto } from "@/lib/api-types";
import {
  Button,
  Card,
  EmptyState,
  Input,
  SectionLabel,
  Select,
  Sheet,
  useToast,
} from "@/components/ui";
import { Banner, CsvImportSheet, MoneyRow, NeutralBadge, RowsSkeleton } from "@/components/common";
import { ConnectBankButton } from "./ConnectBankButton";

/**
 * Money › Inbox (DESIGN.md §6): bank and CSV rows with the model's guess,
 * confirmed, edited or dismissed by hand. Confirming writes the expense and
 * links it back to the transaction; nothing lands in the budget on its own.
 */
export function InboxTab({ defaultFunderId }: { defaultFunderId: string | null }) {
  const { data, mutate } = useSWR<TransactionDto[]>("/api/transactions?status=NEW", fetcher);
  const catalog = useCatalog();
  const { me } = useMe();
  const { toast } = useToast();
  const refreshAll = useRefreshAll();
  const [editing, setEditing] = useState<TransactionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function confirm(tx: TransactionDto, overrides?: Record<string, unknown>) {
    setBusyId(tx.id);
    setError(null);
    try {
      await apiPost(`/api/transactions/${tx.id}/confirm`, {
        description: tx.merchant ?? tx.name,
        eventId: tx.aiEventId,
        categoryId: tx.aiCategoryId,
        vendorId: tx.aiVendorId,
        funderId: defaultFunderId,
        ...overrides,
      });
      toast("Confirmed · added to expenses");
      await mutate();
      refreshAll();
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm that row");
    } finally {
      setBusyId(null);
    }
  }

  async function ignore(tx: TransactionDto) {
    setBusyId(tx.id);
    try {
      await apiPost(`/api/transactions/${tx.id}/ignore`);
      await mutate();
      refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not dismiss that row");
    } finally {
      setBusyId(null);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setError(null);
    try {
      const result = await apiPost<{ newCount: number }>("/api/plaid/sync");
      toast(`${result.newCount} new ${result.newCount === 1 ? "row" : "rows"}`);
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <SectionLabel>Bring money in</SectionLabel>
        <div className="flex flex-wrap gap-2">
          <ConnectBankButton onError={setError} />
          <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
            Import CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={syncNow} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </div>
      </Card>

      {error ? <Banner tone="warn">{error}</Banner> : null}

      {!data ? (
        <RowsSkeleton rows={4} title />
      ) : data.length === 0 ? (
        <EmptyState
          title="The inbox is empty"
          description="Connected bank rows and imported CSV rows land here for one tap of confirmation."
        />
      ) : (
        <Card>
          <SectionLabel>{data.length} waiting</SectionLabel>
          <div className="flex flex-col">
            {data.map((tx) => (
              <MoneyRow
                key={tx.id}
                title={tx.merchant ?? tx.name}
                amountCents={tx.amountCents}
                meta={
                  <>
                    <span>{shortDate(tx.date, me?.timezone)}</span>
                    <span>{guessLine(tx, catalog)}</span>
                    {tx.pending ? <NeutralBadge>pending</NeutralBadge> : null}
                  </>
                }
                right={
                  <>
                    <Button
                      size="sm"
                      disabled={busyId === tx.id}
                      onClick={() =>
                        (tx.aiConfidence ?? 0) < 0.5 || !tx.aiEventId ? setEditing(tx) : confirm(tx)
                      }
                    >
                      Confirm
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(tx)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === tx.id}
                      onClick={() => ignore(tx)}
                    >
                      Not wedding
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        </Card>
      )}

      <EditRowSheet
        tx={editing}
        defaultFunderId={defaultFunderId}
        onClose={() => setEditing(null)}
        onConfirm={confirm}
      />

      <CsvImportSheet
        open={importing}
        onClose={() => setImporting(false)}
        endpoint="/api/transactions/import-csv"
        title="Import bank CSV"
        help="Export from your bank, then tell us which column is the date, the description and the amount."
        onDone={() => {
          void mutate();
        }}
      />
    </div>
  );
}

function guessLine(tx: TransactionDto, catalog: ReturnType<typeof useCatalog>): string {
  if (tx.aiIsWedding == null) return "Not looked at yet";
  const confidence = tx.aiConfidence ?? 0;
  const strength = confidence < 0.5 ? "Unsure" : confidence < 0.8 ? "Likely" : "Confident";
  if (!tx.aiIsWedding) return `Not wedding · ${strength}`;
  const event = catalog.events.find((e) => e.id === tx.aiEventId);
  const category = catalog.categories.find((c) => c.id === tx.aiCategoryId);
  const parts = [
    "Wedding?",
    strength,
    event?.name,
    category?.name,
    `${Math.round(confidence * 100)}%`,
  ].filter(Boolean);
  return parts.join(" · ");
}

function EditRowSheet({
  tx,
  defaultFunderId,
  onClose,
  onConfirm,
}: {
  tx: TransactionDto | null;
  defaultFunderId: string | null;
  onClose: () => void;
  onConfirm: (tx: TransactionDto, overrides: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Sheet
      open={Boolean(tx)}
      onClose={onClose}
      title="Check this row"
      className="max-h-[92vh] overflow-y-auto"
    >
      {tx ? (
        // Keyed by the row, so the guesses for each transaction load fresh.
        <EditRowBody key={tx.id} tx={tx} defaultFunderId={defaultFunderId} onConfirm={onConfirm} />
      ) : null}
    </Sheet>
  );
}

function EditRowBody({
  tx,
  defaultFunderId,
  onConfirm,
}: {
  tx: TransactionDto;
  defaultFunderId: string | null;
  onConfirm: (tx: TransactionDto, overrides: Record<string, unknown>) => Promise<void>;
}) {
  const catalog = useCatalog();
  const [description, setDescription] = useState(tx.merchant ?? tx.name);
  const [eventId, setEventId] = useState(tx.aiEventId ?? "");
  const [categoryId, setCategoryId] = useState(tx.aiCategoryId ?? "");
  const [vendorId, setVendorId] = useState(tx.aiVendorId ?? "");
  const [funderId, setFunderId] = useState(defaultFunderId ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {tx.aiReason ? <p className="text-sm text-ink-soft">{tx.aiReason}</p> : null}
      <Input
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">Choose an event</option>
          {catalog.events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </Select>
        <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">No category</option>
          {catalog.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
          <option value="">No vendor</option>
          {catalog.vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </Select>
        <Select label="Paid by" value={funderId} onChange={(e) => setFunderId(e.target.value)}>
          <option value="">Choose who paid</option>
          {catalog.funders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </div>
      <Button
        disabled={saving || !eventId || !funderId}
        onClick={async () => {
          setSaving(true);
          try {
            await onConfirm(tx, {
              description,
              eventId,
              categoryId: categoryId || null,
              vendorId: vendorId || null,
              funderId,
            });
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Saving…" : "Confirm as an expense"}
      </Button>
    </div>
  );
}
