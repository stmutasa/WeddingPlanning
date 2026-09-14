"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiPost, dollarsToCents, fetcher } from "@/lib/api";
import { useCatalog, useMe, useRefreshAll } from "@/lib/hooks";
import { shortDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money/format";
import type { VendorStatus } from "@/lib/types";
import { VENDOR_STATUSES } from "@/lib/types";
import type { VendorWithMoneyDto } from "@/lib/api-types";
import {
  Button,
  Card,
  EmptyState,
  Input,
  SectionLabel,
  Select,
  Sheet,
  StatusPill,
  Tabs,
  useToast,
} from "@/components/ui";
import { EventChip, NeutralBadge, RowsSkeleton } from "@/components/common";
import { VendorSheet } from "./VendorSheet";

/** Money › Vendors (DESIGN.md §6), also rendered on its own at /vendors. */
export function VendorsTab() {
  const { data } = useSWR<VendorWithMoneyDto[]>("/api/vendors?withMoney=1", fetcher);
  const { me } = useMe();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [adding, setAdding] = useState(false);

  const vendors = (data ?? []).filter((v) => filter === "ALL" || v.status === filter);

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={filter}
        onChange={setFilter}
        items={[
          { value: "ALL", label: "All" },
          ...VENDOR_STATUSES.map((status) => ({
            value: status,
            label: status.charAt(0) + status.slice(1).toLowerCase(),
          })),
        ]}
      />

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)}>
          Add vendor
        </Button>
      </div>

      {!data ? (
        <RowsSkeleton rows={4} title />
      ) : vendors.length === 0 ? (
        <EmptyState
          title="No vendors here yet"
          description="Add the venue, the photographer, the caterer — each one keeps its quote, contacts and payment schedule."
          action={<Button onClick={() => setAdding(true)}>Add vendor</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {vendors.map((vendor) => (
            <Card key={vendor.id} className="flex flex-col gap-2">
              <button onClick={() => setOpenId(vendor.id)} className="focus-ring text-left">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display text-[15px] font-bold text-ink">{vendor.name}</span>
                  {vendor.status === "BOOKED" || vendor.status === "PAID" ? (
                    <StatusPill status="ok">{vendor.status.toLowerCase()}</StatusPill>
                  ) : (
                    <NeutralBadge>{vendor.status.toLowerCase()}</NeutralBadge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  {vendor.event ? (
                    <EventChip slug={vendor.event.slug} name={vendor.event.name} />
                  ) : null}
                  {vendor.category ? <span>{vendor.category.name}</span> : null}
                </div>
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft">
                  <span>
                    Quoted{" "}
                    <span className="font-semibold tabular-nums text-ink">
                      {vendor.quotedCents != null ? formatUSD(vendor.quotedCents) : "—"}
                    </span>
                  </span>
                  <span>
                    Paid{" "}
                    <span className="font-semibold tabular-nums text-ink">
                      {formatUSD(vendor.paidCents)}
                    </span>
                  </span>
                </dl>
                {vendor.nextDue ? (
                  <p className="mt-1 text-xs text-ink-soft">
                    Next: {vendor.nextDue.label} · {formatUSD(vendor.nextDue.amountCents)} ·{" "}
                    {shortDate(vendor.nextDue.dueDate, me?.timezone)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-ink-soft">No payments scheduled.</p>
                )}
              </button>
            </Card>
          ))}
        </div>
      )}

      <VendorSheet id={openId} onClose={() => setOpenId(null)} />
      <AddVendorSheet open={adding} onClose={() => setAdding(false)} onCreated={setOpenId} />
    </div>
  );
}

function AddVendorSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const catalog = useCatalog();
  const { toast } = useToast();
  const refreshAll = useRefreshAll();
  const [name, setName] = useState("");
  const [eventId, setEventId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<VendorStatus>("CONSIDERING");
  const [quoted, setQuoted] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const vendor = await apiPost<{ id: string }>("/api/vendors", {
        name: name.trim(),
        eventId: eventId || null,
        categoryId: categoryId || null,
        status,
        quotedCents: quoted.trim() ? dollarsToCents(quoted) : null,
        phone: phone.trim() || null,
      });
      toast(`Added ${name.trim()}`);
      refreshAll();
      setName("");
      setQuoted("");
      setPhone("");
      onClose();
      onCreated(vendor.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add a vendor"
      className="max-h-[92vh] overflow-y-auto"
    >
      <div className="flex flex-col gap-3">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">No event</option>
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
            <option value="">No category</option>
            {catalog.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Stage"
            value={status}
            onChange={(e) => setStatus(e.target.value as VendorStatus)}
          >
            {VENDOR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </Select>
          <Input
            label="Quoted (USD)"
            inputMode="decimal"
            value={quoted}
            onChange={(e) => setQuoted(e.target.value)}
          />
        </div>
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <SectionLabel>Contacts, schedule and attachments come next, in the vendor.</SectionLabel>
        <Button onClick={save} disabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Add vendor"}
        </Button>
      </div>
    </Sheet>
  );
}
