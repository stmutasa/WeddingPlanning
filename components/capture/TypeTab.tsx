"use client";

import { useEffect, useRef, useState } from "react";
import { apiPost } from "@/lib/api";
import { useAiEnabled } from "@/lib/hooks";
import { isDisabled, type QuickAddDto, type MaybeDisabled } from "@/lib/api-types";
import type { ExpenseDraft } from "@/lib/expense-draft";
import { Button, Skeleton, Textarea } from "@/components/ui";
import { Banner, EventChip, PersonChip, hueForFunder } from "@/components/common";
import type { CatalogBundle } from "./types";
import { ExpenseFields } from "./ExpenseFields";

/**
 * DESIGN.md §6 "Type": one line of text, parsed live (PROMPTS.md §1,
 * debounced 400ms at three words or more), shown back as chips that are all
 * editable. Nothing is written until Save. With the assistant switched off
 * the same box is just the description field and the form below does the
 * work — the manual path never depends on a model.
 */
export function TypeTab({
  draft,
  onChange,
  catalog,
  onSave,
  saving,
}: {
  draft: ExpenseDraft;
  onChange: (patch: Partial<ExpenseDraft>) => void;
  catalog: CatalogBundle;
  onSave: (source: string) => void;
  saving: boolean;
}) {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [aiRefused, setAiRefused] = useState(false);
  const ai = useAiEnabled();
  // Known up front on a keyless server; also set if a call comes back
  // `disabled` (README: the AI routes answer that with a 200).
  const aiOff = aiRefused || (ai.ready && !ai.enabled);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState(false);
  const [needsRate, setNeedsRate] = useState(false);
  const [showFields, setShowFields] = useState(false);
  const lastParsed = useRef("");

  async function parse(value: string) {
    if (!value.trim() || aiOff) return;
    lastParsed.current = value;
    setParsing(true);
    setError(null);
    try {
      const result = await apiPost<MaybeDisabled<QuickAddDto>>("/api/ai/quick-add", {
        text: value,
      });
      if (isDisabled(result)) {
        setAiRefused(true);
        onChange({ description: value });
        return;
      }
      const r = result.resolved;
      setParsed(true);
      setNeedsRate(r.amountCents == null && r.originalCurrency !== "USD");
      onChange({
        description: result.draft.description || value,
        amount: r.originalAmount != null ? String(r.originalAmount) : draft.amount,
        currency: r.originalCurrency || "USD",
        fxRate: r.fxRate != null ? String(r.fxRate) : "",
        date: r.date || draft.date,
        eventId: r.eventId ?? draft.eventId,
        categoryId: r.categoryId ?? draft.categoryId,
        vendorId: r.vendorId ?? draft.vendorId,
        funderId: r.funderId ?? draft.funderId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that");
    } finally {
      setParsing(false);
    }
  }

  // Debounced 400ms, from three words up (PROMPTS.md §1).
  useEffect(() => {
    if (aiOff) return;
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length < 3 || text === lastParsed.current) return;
    const timer = setTimeout(() => void parse(text), 400);
    return () => clearTimeout(timer);
    // `parse` and `onChange` are stable enough for this debounce; re-running
    // on every draft change would refire the model call on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, aiOff]);

  const event = catalog.events.find((e) => e.id === draft.eventId);
  const category = catalog.categories.find((c) => c.id === draft.categoryId);
  const vendor = catalog.vendors.find((v) => v.id === draft.vendorId);
  const funder = catalog.funders.find((f) => f.id === draft.funderId);
  const amountLabel = draft.amount ? `${draft.currency.toUpperCase()} ${draft.amount}` : null;

  return (
    <div className="flex flex-col gap-3">
      {aiOff ? (
        <Banner tone="info">
          The assistant is off, so this is the plain form — the same fields, filled in by hand.
        </Banner>
      ) : (
        <>
          <Textarea
            label="What happened?"
            rows={2}
            autoFocus
            placeholder="paid florist 800 deposit ruracio"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-xs text-ink-soft">
            Type it the way you would say it. Amount, event, vendor and who paid are read back as
            chips you can change.
          </p>
        </>
      )}

      {error ? <Banner tone="warn">{error}</Banner> : null}

      {parsing ? (
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
      ) : null}

      {!aiOff && parsed && !parsing ? (
        <div className="flex flex-wrap items-center gap-2">
          <ChipButton onClick={() => setShowFields(true)}>
            {amountLabel ?? "Add an amount"}
          </ChipButton>
          <ChipButton onClick={() => setShowFields(true)}>
            {event ? <EventChip slug={event.slug} name={event.name} /> : "Which event?"}
          </ChipButton>
          {category ? (
            <ChipButton onClick={() => setShowFields(true)}>{category.name}</ChipButton>
          ) : null}
          {vendor ? (
            <ChipButton onClick={() => setShowFields(true)}>{vendor.name}</ChipButton>
          ) : null}
          {funder ? (
            <ChipButton onClick={() => setShowFields(true)}>
              <PersonChip name={funder.name} hue={hueForFunder(funder, catalog.people)} />
            </ChipButton>
          ) : null}
          <ChipButton onClick={() => setShowFields(true)}>{draft.date}</ChipButton>
        </div>
      ) : null}

      {needsRate ? (
        <Banner tone="warn">
          Today&apos;s {draft.currency.toUpperCase()} rate could not be fetched. Enter the rate
          below and the amount is stored in USD.
        </Banner>
      ) : null}

      {aiOff || showFields || needsRate ? (
        <ExpenseFields
          draft={draft}
          onChange={onChange}
          events={catalog.events}
          categories={catalog.categories}
          funders={catalog.funders}
          vendors={catalog.vendors}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowFields(true)}
          className="focus-ring min-h-11 self-start rounded-lg px-1 text-left text-[13px] font-semibold text-primary underline"
        >
          Edit the details
        </button>
      )}

      <Button onClick={() => onSave(aiOff ? "MANUAL" : "QUICK_ADD")} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

function ChipButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring inline-flex min-h-11 items-center rounded-md bg-sunken px-2.5 text-[12px] font-semibold text-ink"
    >
      {children}
    </button>
  );
}
