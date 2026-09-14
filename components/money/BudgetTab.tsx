"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiPost, apiPut, centsToInput, dollarsToCents, fetcher } from "@/lib/api";
import { useAiEnabled, useCatalog, useRefreshAll } from "@/lib/hooks";
import { formatUSD } from "@/lib/money/format";
import {
  isDisabled,
  type BudgetDraftDto,
  type BudgetLineDto,
  type BudgetSummaryDto,
  type MaybeDisabled,
} from "@/lib/api-types";
import {
  Button,
  Card,
  Input,
  Money,
  SectionLabel,
  Sheet,
  StackedBar,
  useToast,
} from "@/components/ui";
import { Banner, CardSkeleton, ForecastPill, asEventSlug } from "@/components/common";

/**
 * Money › Budget (DESIGN.md §6): the envelope editor with the sum warning,
 * optional planned lines per category, and "Draft with AI" (PROMPTS.md §5)
 * shown as a diff that is only written on Apply.
 */
export function BudgetTab() {
  const { toast } = useToast();
  const refreshAll = useRefreshAll();
  const { data: summary, mutate } = useSWR<BudgetSummaryDto>("/api/budget/summary", fetcher);
  // Edits override what the summary says; nothing has to be copied into
  // state when the summary refetches.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<BudgetDraftDto | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const ai = useAiEnabled();
  const [linesFor, setLinesFor] = useState<string | null>(null);

  if (!summary) return <CardSkeleton />;

  const envelopeValue = (eventId: string, budgetCents: number) =>
    edits[eventId] ?? centsToInput(budgetCents);

  const allocated = summary.envelopes.reduce(
    (total, e) => total + dollarsToCents(envelopeValue(e.eventId, e.budgetCents)),
    0,
  );
  const unallocated = summary.totalCents - allocated;

  async function saveEnvelopes() {
    if (!summary) return;
    setSaving(true);
    setError(null);
    try {
      await apiPut("/api/budget/envelopes", {
        envelopes: summary.envelopes.map((e) => ({
          eventId: e.eventId,
          budgetCents: dollarsToCents(envelopeValue(e.eventId, e.budgetCents)),
        })),
      });
      toast("Envelopes saved");
      setEdits({});
      await mutate();
      refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the envelopes");
    } finally {
      setSaving(false);
    }
  }

  async function draftWithAi() {
    setDrafting(true);
    setError(null);
    try {
      const result = await apiPost<MaybeDisabled<BudgetDraftDto>>("/api/ai/budget-draft");
      if (isDisabled(result)) {
        setAiFailed(true);
        return;
      }
      setDraft(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The draft could not be made");
    } finally {
      setDrafting(false);
    }
  }

  async function applyDraft() {
    if (!draft) return;
    setSaving(true);
    try {
      const withIds = draft.envelopes.filter((e) => e.eventId);
      await apiPut("/api/budget/envelopes", {
        envelopes: withIds.map((e) => ({ eventId: e.eventId, budgetCents: e.budgetCents })),
      });

      const byEvent = new Map<
        string,
        { categoryId: string; plannedCents: number; note?: string | null; source: string }[]
      >();
      for (const line of draft.lines) {
        if (!line.eventId || !line.categoryId) continue;
        const list = byEvent.get(line.eventId) ?? [];
        list.push({
          categoryId: line.categoryId,
          plannedCents: line.plannedCents,
          note: line.rationale,
          source: "AI",
        });
        byEvent.set(line.eventId, list);
      }
      for (const [eventId, lines] of byEvent) {
        await apiPut("/api/budget/lines", { eventId, lines });
      }

      toast("Budget updated");
      setDraft(null);
      setEdits({});
      await mutate();
      refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply the draft");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <SectionLabel>The whole budget</SectionLabel>
        <div className="flex items-baseline justify-between gap-3">
          <Money cents={summary.totalCents} size="big" />
          <ForecastPill status={summary.status} />
        </div>
        <StackedBar
          className="mt-3"
          paidCents={summary.paidCents}
          committedCents={summary.committedCents}
          totalCents={summary.totalCents}
        />
        <p className="mt-2 text-[13px] text-ink-soft">
          {formatUSD(summary.paidCents)} paid · {formatUSD(summary.committedCents)} committed ·{" "}
          {formatUSD(summary.remainingCents)} remaining
        </p>
      </Card>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {unallocated !== 0 ? (
        <Banner tone="warn">
          The envelopes {unallocated > 0 ? "leave" : "exceed the budget by"}{" "}
          {formatUSD(Math.abs(unallocated))}
          {unallocated > 0 ? " unallocated" : ""}.
        </Banner>
      ) : null}

      <Card>
        <SectionLabel>Envelopes</SectionLabel>
        <div className="flex flex-col gap-4">
          {summary.envelopes.map((envelope) => (
            <div key={envelope.eventId} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: `var(--ev-${asEventSlug(envelope.eventSlug)})` }}
                  />
                  {envelope.eventName}
                </span>
                <ForecastPill status={envelope.status} />
              </div>
              <StackedBar
                height={6}
                colorVar={`ev-${asEventSlug(envelope.eventSlug)}`}
                paidCents={envelope.paidCents}
                committedCents={envelope.committedCents}
                totalCents={envelope.budgetCents}
              />
              <div className="flex items-end gap-3">
                <Input
                  className="flex-1"
                  label="Envelope (USD)"
                  inputMode="decimal"
                  value={envelopeValue(envelope.eventId, envelope.budgetCents)}
                  onChange={(e) =>
                    setEdits((prev) => ({ ...prev, [envelope.eventId]: e.target.value }))
                  }
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="mb-0.5"
                  onClick={() => setLinesFor(envelope.eventId)}
                >
                  Lines
                </Button>
              </div>
              <p className="text-xs text-ink-soft">
                {formatUSD(envelope.paidCents)} paid · {formatUSD(envelope.committedCents)}{" "}
                committed · planned {formatUSD(envelope.plannedCents)} · forecast{" "}
                {formatUSD(envelope.forecastCents)}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={saveEnvelopes} disabled={saving}>
            {saving ? "Saving…" : "Save envelopes"}
          </Button>
          {!aiFailed && ai.enabled ? (
            <Button
              variant="secondary"
              className="flex-1"
              onClick={draftWithAi}
              disabled={drafting}
            >
              {drafting ? "Drafting…" : "Draft with AI"}
            </Button>
          ) : null}
        </div>
        {aiFailed || (ai.ready && !ai.enabled) ? (
          <p className="mt-2 text-xs text-ink-soft">
            The assistant is off, so the envelopes are yours to set by hand.
          </p>
        ) : null}
      </Card>

      <LinesSheet
        eventId={linesFor}
        onClose={() => setLinesFor(null)}
        onSaved={async () => {
          await mutate();
          refreshAll();
        }}
      />

      <Sheet
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title="Drafted budget"
        className="max-h-[92vh] overflow-y-auto"
      >
        {draft ? (
          <div className="flex flex-col gap-4">
            {draft.warnings.length > 0 ? (
              <div className="flex flex-col gap-2">
                {draft.warnings.map((warning, i) => (
                  <Banner key={i} tone="warn">
                    {warning}
                  </Banner>
                ))}
              </div>
            ) : null}

            <div>
              <p className="label-tracked mb-2">Envelopes</p>
              <ul className="flex flex-col gap-2">
                {draft.envelopes.map((envelope) => (
                  <li
                    key={envelope.eventSlug}
                    className="border-t border-line pt-2 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold text-ink">{envelope.eventName}</span>
                      <span className="text-sm tabular-nums text-ink">
                        {formatUSD(envelope.currentCents)} → {formatUSD(envelope.budgetCents)}
                      </span>
                    </div>
                    <p className="text-xs text-ink-soft">{envelope.rationale}</p>
                  </li>
                ))}
              </ul>
            </div>

            {draft.lines.length > 0 ? (
              <div>
                <p className="label-tracked mb-2">Planned lines</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {draft.lines.map((line, i) => (
                    <li
                      key={`${line.eventSlug}-${line.categoryName}-${i}`}
                      className="flex justify-between gap-3"
                    >
                      <span className="text-ink-soft">
                        {line.eventSlug} · {line.categoryName}
                      </span>
                      <span className="tabular-nums text-ink">{formatUSD(line.plannedCents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {draft.assumptions.length > 0 ? (
              <div>
                <p className="label-tracked mb-2">Assumptions</p>
                <ul className="list-disc pl-5 text-sm text-ink-soft">
                  {draft.assumptions.map((assumption, i) => (
                    <li key={i}>{assumption}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setDraft(null)}>
                Discard
              </Button>
              <Button className="flex-1" onClick={applyDraft} disabled={saving}>
                {saving ? "Applying…" : "Apply"}
              </Button>
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

/** Planned lines for one event, per category (DESIGN.md §6 "optional lines"). */
function LinesSheet({
  eventId,
  onClose,
  onSaved,
}: {
  eventId: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const catalog = useCatalog();
  const { toast } = useToast();
  const { data, mutate } = useSWR<BudgetLineDto[]>(
    eventId ? `/api/budget-lines?eventId=${eventId}` : null,
    fetcher,
  );
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // As above: what the person typed wins, the stored line is the fallback,
  // so a refetch never has to be copied into state.
  const lineValue = (categoryId: string) => {
    const edited = edits[categoryId];
    if (edited != null) return edited;
    const line = data?.find((l) => l.categoryId === categoryId);
    return line ? centsToInput(line.plannedCents) : "";
  };

  async function save() {
    if (!eventId) return;
    setSaving(true);
    try {
      const lines = catalog.categories
        .map((category) => ({ categoryId: category.id, value: lineValue(category.id) }))
        .filter((row) => row.value.trim() && dollarsToCents(row.value) > 0)
        .map((row) => ({ categoryId: row.categoryId, plannedCents: dollarsToCents(row.value) }));
      await apiPut("/api/budget/lines", { eventId, lines });
      toast(`Saved ${lines.length} ${lines.length === 1 ? "line" : "lines"}`);
      setEdits({});
      await mutate();
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const event = catalog.events.find((e) => e.id === eventId);

  return (
    <Sheet
      open={Boolean(eventId)}
      onClose={onClose}
      title={event ? `${event.name} · planned lines` : "Planned lines"}
      className="max-h-[92vh] overflow-y-auto"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-soft">
          Planned money per category. Anything left blank is not planned; the forecast counts
          whatever a line plans beyond what is already paid or committed.
        </p>
        {catalog.categories.map((category) => (
          <Input
            key={category.id}
            label={category.name}
            inputMode="decimal"
            placeholder="0.00"
            value={lineValue(category.id)}
            onChange={(e) => setEdits((prev) => ({ ...prev, [category.id]: e.target.value }))}
          />
        ))}
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save lines"}
        </Button>
      </div>
    </Sheet>
  );
}
