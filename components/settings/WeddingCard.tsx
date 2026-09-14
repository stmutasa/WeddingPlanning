"use client";

import { useState } from "react";
import { apiPatch, centsToInput, dollarsToCents } from "@/lib/api";
import { useRefreshAll, useWedding } from "@/lib/hooks";
import { dayInput } from "@/lib/dates";
import type { WeddingDto } from "@/lib/api-types";
import { Button, Card, Input, SectionLabel, Select, useToast } from "@/components/ui";
import { Banner, CardSkeleton } from "@/components/common";

/** Settings › Wedding (DESIGN.md §6): names, city, month or date, budget, split. */
export function WeddingCard() {
  const { wedding, mutate } = useWedding();
  if (!wedding) return <CardSkeleton />;
  return <WeddingForm key={wedding.id} wedding={wedding} onSaved={mutate} />;
}

function WeddingForm({
  wedding,
  onSaved,
}: {
  wedding: WeddingDto;
  onSaved: () => Promise<unknown>;
}) {
  const { toast } = useToast();
  const refreshAll = useRefreshAll();
  const [coupleNames, setCoupleNames] = useState(wedding.coupleNames);
  const [city, setCity] = useState(wedding.city);
  const [targetMonth, setTargetMonth] = useState(wedding.targetMonth);
  const [weddingDate, setWeddingDate] = useState(
    wedding.weddingDate ? dayInput(wedding.weddingDate, wedding.eventTimezone) : "",
  );
  const [budget, setBudget] = useState(centsToInput(wedding.budgetCents));
  const [numerator, setNumerator] = useState(String(wedding.splitNumerator));
  const [denominator, setDenominator] = useState(String(wedding.splitDenominator));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiPatch("/api/wedding", {
        coupleNames: coupleNames.trim(),
        city: city.trim(),
        targetMonth: targetMonth.trim(),
        weddingDate: weddingDate ? `${weddingDate}T12:00:00.000Z` : null,
        budgetCents: dollarsToCents(budget),
        splitNumerator: Number(numerator) || 1,
        splitDenominator: Number(denominator) || 2,
      });
      toast("Wedding saved");
      await onSaved();
      refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <SectionLabel>The wedding</SectionLabel>
      <div className="flex flex-col gap-3">
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Input label="Names" value={coupleNames} onChange={(e) => setCoupleNames(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <Input
            label="Target month"
            placeholder="2027-08"
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
          />
        </div>
        <Input
          label="Exact date (once it is set)"
          type="date"
          value={weddingDate}
          onChange={(e) => setWeddingDate(e.target.value)}
        />
        <Input
          label="Total budget (USD)"
          inputMode="decimal"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
        <div>
          <p className="label-tracked mb-2">Split for settle-up</p>
          <div className="flex items-center gap-2">
            <Input
              className="w-20"
              inputMode="numeric"
              value={numerator}
              onChange={(e) => setNumerator(e.target.value)}
            />
            <span className="text-ink-soft">of</span>
            <Input
              className="w-20"
              inputMode="numeric"
              value={denominator}
              onChange={(e) => setDenominator(e.target.value)}
            />
            <span className="text-sm text-ink-soft">to Annette</span>
          </div>
        </div>
        <Select label="Wedding timezone" value={wedding.eventTimezone} disabled>
          <option value={wedding.eventTimezone}>{wedding.eventTimezone.replace("_", " ")}</option>
        </Select>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save the wedding"}
        </Button>
      </div>
    </Card>
  );
}
