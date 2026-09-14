"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiPatch, apiPost, fetcher } from "@/lib/api";
import { relativeShort } from "@/lib/dates";
import type { PlaidStateDto } from "@/lib/api-types";
import { Button, Card, SectionLabel, Toggle, useToast } from "@/components/ui";
import { Banner, CardSkeleton } from "@/components/common";
import { ConnectBankButton } from "@/components/money/ConnectBankButton";

/** Settings › Bank (DESIGN.md §6): institutions, watched accounts, sync, errors. */
export function BankCard() {
  const { data, mutate } = useSWR<PlaidStateDto>("/api/plaid", fetcher);
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  if (!data) return <CardSkeleton />;

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      const result = await apiPost<{ newCount: number }>("/api/plaid/sync");
      toast(`${result.newCount} new ${result.newCount === 1 ? "row" : "rows"} in the inbox`);
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function setWatched(accountId: string, watched: boolean) {
    await apiPatch(`/api/plaid/accounts/${accountId}`, { watched });
    await mutate();
  }

  return (
    <Card>
      <SectionLabel>Bank</SectionLabel>

      {!data.configured ? (
        <Banner tone="info" className="mb-3">
          Plaid is not configured on this server, so bank connections are off. CSV import in Money ›
          Inbox does the same job by hand.
        </Banner>
      ) : (
        <p className="mb-3 text-xs text-ink-soft">Plaid environment: {data.environment}</p>
      )}

      {error ? (
        <Banner tone="warn" className="mb-3">
          {error}
        </Banner>
      ) : null}

      {data.items.length === 0 ? (
        <p className="mb-3 text-sm text-ink-soft">No bank connected.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-3">
          {data.items.map((item) => (
            <li key={item.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-semibold text-ink">
                  {item.institution ?? "Bank"}
                </span>
                <span className="text-xs text-ink-soft">
                  {item.lastSyncAt
                    ? `synced ${relativeShort(item.lastSyncAt)} ago`
                    : "never synced"}
                </span>
              </div>
              {item.lastError ? (
                <Banner tone="danger" className="mt-1">
                  {item.lastError}
                </Banner>
              ) : null}
              <ul className="mt-2 flex flex-col gap-2">
                {item.accounts.map((account) => (
                  <li key={account.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink-soft">
                      {account.name}
                      {account.mask ? ` ····${account.mask}` : ""}
                    </span>
                    <Toggle
                      checked={account.watched}
                      onChange={(checked) => setWatched(account.id, checked)}
                      label={account.watched ? "Watched" : "Ignored"}
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <ConnectBankButton onError={setError} />
        <Button size="sm" variant="secondary" onClick={sync} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync now"}
        </Button>
      </div>
    </Card>
  );
}
