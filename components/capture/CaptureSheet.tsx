"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { Sheet, Tabs, Input, Select, Textarea, Button, useToast } from "@/components/ui";

interface EventOption {
  id: string;
  name: string;
}
interface CategoryOption {
  id: string;
  name: string;
}
interface FunderOption {
  id: string;
  name: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function CaptureSheet({
  open,
  onClose,
  defaultFunderId,
}: {
  open: boolean;
  onClose: () => void;
  defaultFunderId: string | null;
}) {
  const [tab, setTab] = useState("form");
  const { data: events } = useSWR<EventOption[]>(open ? "/api/events" : null, fetcher);
  const { data: categories } = useSWR<CategoryOption[]>(open ? "/api/categories" : null, fetcher);
  const { data: funders } = useSWR<FunderOption[]>(open ? "/api/funders" : null, fetcher);
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const dollars = parseFloat(String(form.get("amount") ?? "0"));
    const body = {
      description: String(form.get("description") ?? ""),
      amountCents: Math.round((Number.isFinite(dollars) ? dollars : 0) * 100),
      date: String(form.get("date") ?? new Date().toISOString().slice(0, 10)),
      eventId: String(form.get("eventId") ?? ""),
      categoryId: form.get("categoryId") ? String(form.get("categoryId")) : null,
      funderId: String(form.get("funderId") ?? ""),
      notes: form.get("notes") ? String(form.get("notes")) : null,
      source: "MANUAL",
    };

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Could not save" }));
        toast(error ?? "Could not save");
        return;
      }
      toast(`Saved · $${dollars.toFixed(2)}`);
      e.currentTarget.reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "type", label: "Type" },
          { value: "photo", label: "Photo" },
          { value: "form", label: "Form" },
        ]}
        className="mb-4"
      />

      {tab === "type" ? (
        <ComingSoon text="Type it and let the assistant parse the amount, event and vendor — coming in the next phase." />
      ) : null}
      {tab === "photo" ? (
        <ComingSoon text="Photograph a receipt and have it read automatically — coming in the next phase." />
      ) : null}

      {tab === "form" ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input name="description" label="Description" required placeholder="Florist deposit" />
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="amount"
              label="Amount (USD)"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
            />
            <Input
              name="date"
              label="Date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <Select name="eventId" label="Event" required defaultValue="">
            <option value="" disabled>
              Choose an event
            </option>
            {(events ?? []).map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </Select>
          <Select name="categoryId" label="Category" defaultValue="">
            <option value="">No category</option>
            {(categories ?? []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
          <Select name="funderId" label="Paid by" required defaultValue={defaultFunderId ?? ""}>
            <option value="" disabled>
              Choose who paid
            </option>
            {(funders ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          <Textarea name="notes" label="Notes (optional)" rows={2} />
          <Button type="submit" disabled={submitting} className="mt-1">
            {submitting ? "Saving…" : "Save"}
          </Button>
        </form>
      ) : null}
    </Sheet>
  );
}

function ComingSoon({ text }: { text: string }) {
  return (
    <p className="rounded-lg bg-sunken px-4 py-6 text-center text-sm text-ink-soft">{text}</p>
  );
}
