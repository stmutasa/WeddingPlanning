"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiPost, centsToInput, dollarsToCents, fetcher } from "@/lib/api";
import { useCatalog, useMe, useRefreshAll } from "@/lib/hooks";
import { longDate } from "@/lib/dates";
import { formatUSD } from "@/lib/money/format";
import type { SettleSummaryDto } from "@/lib/api-types";
import {
  Button,
  Card,
  Input,
  Money,
  SectionLabel,
  Sheet,
  Textarea,
  useToast,
} from "@/components/ui";
import { Banner, CardSkeleton, PersonChip, hueForUser } from "@/components/common";

/** Money › Settle up (DESIGN.md §6): fronted totals, who owes whom, history. */
export function SettleTab() {
  const { data, mutate } = useSWR<SettleSummaryDto>("/api/settle", fetcher);
  const catalog = useCatalog();
  const { me } = useMe();
  const { toast } = useToast();
  const refreshAll = useRefreshAll();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!data) return <CardSkeleton />;

  const from = data.owedFromUserId
    ? [data.annette, data.simi].find((p) => p.userId === data.owedFromUserId)
    : null;
  const to = data.owedToUserId
    ? [data.annette, data.simi].find((p) => p.userId === data.owedToUserId)
    : null;

  async function settle() {
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/settlements", {
        amountCents: dollarsToCents(amount),
        note: note.trim() || null,
      });
      toast("Settled");
      setOpen(false);
      setNote("");
      await mutate();
      refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record that");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <SectionLabel>Fronted so far</SectionLabel>
        <div className="flex flex-col gap-3">
          {[data.annette, data.simi].map((person) => (
            <div key={person.name} className="flex items-center justify-between gap-3">
              <PersonChip name={person.name} hue={hueForUser(person.userId, catalog.people)} />
              <span className="text-right">
                <Money cents={person.frontedCents} />
                <span className="ml-2 text-xs text-ink-soft">
                  fair share {formatUSD(person.fairShareCents)}
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-ink-soft">
          Joint money {formatUSD(data.jointCents)} · family {formatUSD(data.familyCents)} — neither
          enters settle-up. Split {data.ratio.numerator}/{data.ratio.denominator}.
        </p>
      </Card>

      <Card>
        <SectionLabel>Where it stands</SectionLabel>
        {data.owedCents > 0 && from && to ? (
          <>
            <p className="text-[15px] text-ink">
              <span className="font-semibold">{from.name}</span> owes{" "}
              <span className="font-semibold">{to.name}</span>{" "}
              <span className="tabular-nums font-semibold">{formatUSD(data.owedCents)}</span>.
            </p>
            <Button
              className="mt-3"
              onClick={() => {
                setAmount(centsToInput(data.owedCents));
                setOpen(true);
              }}
            >
              Mark settled
            </Button>
          </>
        ) : (
          <p className="text-[15px] text-ink">You two are square.</p>
        )}
      </Card>

      <Card>
        <SectionLabel>History</SectionLabel>
        {data.settlements.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing settled yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.settlements.map((settlement) => {
              const payer = [data.annette, data.simi].find(
                (p) => p.userId === settlement.fromUserId,
              );
              const payee = [data.annette, data.simi].find((p) => p.userId === settlement.toUserId);
              return (
                <li
                  key={settlement.id}
                  className="flex items-baseline justify-between gap-3 border-t border-line pt-2 text-sm first:border-t-0 first:pt-0"
                >
                  <span className="text-ink">
                    {payer?.name ?? "Someone"} → {payee?.name ?? "someone"}
                    {settlement.note ? ` · ${settlement.note}` : ""}
                  </span>
                  <span className="shrink-0 text-right">
                    <Money cents={settlement.amountCents} />
                    <span className="ml-2 text-xs text-ink-soft">
                      {longDate(settlement.settledAt, me?.timezone)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Sheet open={open} onClose={() => setOpen(false)} title="Record a settlement">
        <div className="flex flex-col gap-3">
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Input
            label="Amount (USD)"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Textarea label="Note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={settle} disabled={saving}>
            {saving ? "Saving…" : "Record it"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
