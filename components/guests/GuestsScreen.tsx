"use client";

import { useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import { apiDelete, apiPatch, apiPost, fetcher } from "@/lib/api";
import { useCatalog, useRefreshAll } from "@/lib/hooks";
import { RSVP_STATUSES, GUEST_SIDES, type GuestSide, type RsvpStatus } from "@/lib/types";
import type { GuestCountsDto, GuestDto } from "@/lib/api-types";
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  SectionLabel,
  Select,
  Sheet,
  Textarea,
  useToast,
} from "@/components/ui";
import {
  Banner,
  CsvImportSheet,
  NeutralBadge,
  RowsSkeleton,
  asEventSlug,
} from "@/components/common";

/** Tapping an RSVP chip walks this loop (DESIGN.md §6 Guests). */
const CYCLE: RsvpStatus[] = ["NOT_INVITED", "INVITED", "YES", "MAYBE", "NO"];

const GLYPH: Record<RsvpStatus, string> = {
  NOT_INVITED: "–",
  INVITED: "·",
  YES: "✓",
  MAYBE: "?",
  NO: "✕",
};

export function GuestsScreen() {
  const [q, setQ] = useState("");
  // As in Money: the fetch follows the typing rather than racing it.
  const deferredQ = useDeferredValue(q);
  const { data, mutate } = useSWR<GuestDto[]>(
    `/api/guests${deferredQ.trim() ? `?q=${encodeURIComponent(deferredQ.trim())}` : ""}`,
    fetcher,
  );
  const counts = useSWR<{ counts: GuestCountsDto; pendingHouseholds: string[] }>(
    "/api/guests/counts",
    fetcher,
  );
  const catalog = useCatalog();
  const { toast } = useToast();
  const refreshAll = useRefreshAll();
  const [editing, setEditing] = useState<GuestDto | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const households = useMemo(() => {
    const map = new Map<string, GuestDto[]>();
    for (const guest of data ?? []) {
      const key = guest.household ?? `${guest.firstName} ${guest.lastName ?? ""}`.trim();
      map.set(key, [...(map.get(key) ?? []), guest]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  async function cycleRsvp(guest: GuestDto, eventId: string, current: RsvpStatus) {
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    setError(null);
    try {
      await apiPatch(`/api/guests/${guest.id}/events`, { eventId, rsvp: next });
      await mutate();
      await counts.mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change that RSVP");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Guests" subtitle="Households, sides and who has answered" />

      <Card>
        <SectionLabel>Counts</SectionLabel>
        {!counts.data ? (
          <RowsSkeleton rows={2} />
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {catalog.events.map((event) => {
              const row = counts.data!.counts[event.slug];
              if (!row || row.total === 0) return null;
              return (
                <li key={event.id} className="flex flex-wrap items-baseline gap-x-2 text-ink-soft">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: `var(--ev-${asEventSlug(event.slug)})` }}
                  />
                  <span className="font-semibold text-ink">{event.name}:</span>
                  <span>{row.total} invited</span>
                  <span>· {row.YES ?? 0} yes</span>
                  <span>· {row.NO ?? 0} no</span>
                  <span>· {row.heads} heads</span>
                </li>
              );
            })}
            {counts.data.pendingHouseholds.length > 0 ? (
              <li className="pt-1 text-xs text-ink-soft">
                {counts.data.pendingHouseholds.length} households have not answered at all.
              </li>
            ) : null}
          </ul>
        )}
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          className="flex-1"
          label="Search"
          placeholder="Name, household, city"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex gap-2">
          <Button onClick={() => setAdding(true)}>Add guest</Button>
          <Button variant="secondary" onClick={() => setImporting(true)}>
            Import CSV
          </Button>
        </div>
      </div>

      {error ? <Banner tone="warn">{error}</Banner> : null}

      {!data ? (
        <RowsSkeleton rows={6} title />
      ) : households.length === 0 ? (
        <EmptyState
          title="No guests yet"
          description="Add them one at a time, or import a spreadsheet — first name, last name, household, side."
          action={<Button onClick={() => setAdding(true)}>Add guest</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {households.map(([household, guests]) => (
            <Card key={household}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <SectionLabel>{household}</SectionLabel>
                <span className="text-xs text-ink-soft">
                  {guests.length} {guests.length === 1 ? "person" : "people"}
                </span>
              </div>
              <ul className="flex flex-col">
                {guests.map((guest) => (
                  <li key={guest.id} className="border-t border-line py-2 first:border-t-0">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => setEditing(guest)}
                        className="focus-ring min-h-11 flex-1 text-left"
                      >
                        <span className="text-[15px] font-semibold text-ink">
                          {guest.firstName} {guest.lastName ?? ""}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                          <NeutralBadge>{guest.side.toLowerCase()}</NeutralBadge>
                          {guest.plusOnes > 0 ? <span>+{guest.plusOnes}</span> : null}
                          {guest.city ? <span>{guest.city}</span> : null}
                        </span>
                      </button>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {guest.events.map((link) => {
                        const event = catalog.events.find((e) => e.id === link.eventId);
                        if (!event) return null;
                        const slug = asEventSlug(event.slug);
                        return (
                          <button
                            key={link.id}
                            onClick={() => cycleRsvp(guest, link.eventId, link.rsvp)}
                            aria-label={`${event.name}: ${link.rsvp.toLowerCase().replace("_", " ")} — tap to change`}
                            className="focus-ring inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-[11px] font-semibold"
                            style={{
                              backgroundColor: `color-mix(in srgb, var(--ev-${slug}) 12%, transparent)`,
                              color: `var(--ev-${slug})`,
                            }}
                          >
                            {event.name} {GLYPH[link.rsvp]}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <GuestSheet
        guest={editing}
        open={adding || Boolean(editing)}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSaved={async () => {
          await mutate();
          await counts.mutate();
          refreshAll();
          toast("Saved");
        }}
      />

      <CsvImportSheet
        open={importing}
        onClose={() => setImporting(false)}
        endpoint="/api/guests/import-csv"
        title="Import guests"
        help="Columns are matched by name: first name, last name, household, side, email, phone, city, plus ones."
        onDone={async () => {
          await mutate();
          await counts.mutate();
        }}
      />
    </div>
  );
}

function GuestSheet({
  guest,
  open,
  onClose,
  onSaved,
}: {
  guest: GuestDto | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={guest ? "Edit guest" : "Add a guest"}
      className="max-h-[92vh] overflow-y-auto"
    >
      {open ? (
        // Keyed so switching between guests starts from that guest's values.
        <GuestForm key={guest?.id ?? "new"} guest={guest} onClose={onClose} onSaved={onSaved} />
      ) : null}
    </Sheet>
  );
}

function GuestForm({
  guest,
  onClose,
  onSaved,
}: {
  guest: GuestDto | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const catalog = useCatalog();
  const [firstName, setFirstName] = useState(guest?.firstName ?? "");
  const [lastName, setLastName] = useState(guest?.lastName ?? "");
  const [household, setHousehold] = useState(guest?.household ?? "");
  const [side, setSide] = useState<GuestSide>(guest?.side ?? "BOTH");
  const [email, setEmail] = useState(guest?.email ?? "");
  const [phone, setPhone] = useState(guest?.phone ?? "");
  const [city, setCity] = useState(guest?.city ?? "");
  const [plusOnes, setPlusOnes] = useState(String(guest?.plusOnes ?? 0));
  const [dietary, setDietary] = useState(guest?.dietary ?? "");
  const [notes, setNotes] = useState(guest?.notes ?? "");
  const [rsvps, setRsvps] = useState<Record<string, RsvpStatus>>(() =>
    Object.fromEntries((guest?.events ?? []).map((link) => [link.eventId, link.rsvp])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!firstName.trim()) {
      setError("A first name at least");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        household: household.trim() || null,
        side,
        email: email.trim() || null,
        phone: phone.trim() || null,
        city: city.trim() || null,
        plusOnes: Number(plusOnes) || 0,
        dietary: dietary.trim() || null,
        notes: notes.trim() || null,
      };
      const saved = guest
        ? await apiPatch<GuestDto>(`/api/guests/${guest.id}`, body)
        : await apiPost<GuestDto>("/api/guests", body);

      for (const [eventId, rsvp] of Object.entries(rsvps)) {
        const before =
          guest?.events.find((link) => link.eventId === eventId)?.rsvp ?? "NOT_INVITED";
        if (before !== rsvp) {
          await apiPatch(`/api/guests/${saved.id}/events`, { eventId, rsvp });
        }
      }

      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that guest");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!guest) return;
    setSaving(true);
    try {
      await apiDelete(`/api/guests/${guest.id}`);
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <Input label="Household" value={household} onChange={(e) => setHousehold(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Side" value={side} onChange={(e) => setSide(e.target.value as GuestSide)}>
          {GUEST_SIDES.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase()}
            </option>
          ))}
        </Select>
        <Input
          label="Plus ones"
          inputMode="numeric"
          value={plusOnes}
          onChange={(e) => setPlusOnes(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
      <Input label="Dietary" value={dietary} onChange={(e) => setDietary(e.target.value)} />

      <div>
        <SectionLabel>RSVP per event</SectionLabel>
        <div className="flex flex-col gap-2">
          {catalog.events.map((event) => (
            <Select
              key={event.id}
              label={event.name}
              value={rsvps[event.id] ?? "NOT_INVITED"}
              onChange={(e) =>
                setRsvps((prev) => ({ ...prev, [event.id]: e.target.value as RsvpStatus }))
              }
            >
              {RSVP_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.toLowerCase().replace("_", " ")}
                </option>
              ))}
            </Select>
          ))}
        </div>
      </div>

      <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving…" : guest ? "Save guest" : "Add guest"}
      </Button>
      {guest ? (
        <Button variant="danger" onClick={remove} disabled={saving}>
          Delete guest
        </Button>
      ) : null}
    </div>
  );
}
