"use client";

import { useState } from "react";
import useSWR from "swr";
import { ApiError, apiPost, fetcher } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { formatUSD } from "@/lib/money/format";
import { longDate, relativeShort } from "@/lib/dates";
import type { BriefDto, BudgetSummaryDto } from "@/lib/api-types";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  SectionLabel,
  Skeleton,
  StackedBar,
  Toggle,
  useToast,
} from "@/components/ui";
import { Banner, ConfirmDialog, ForecastPill } from "@/components/common";
import { Markdown } from "./Markdown";

/**
 * Brief (DESIGN.md §6 / §8): the nightly document, the token URL for an
 * external chat, and the Drive toggle when the server has that flag on.
 */
export function BriefScreen() {
  const { data, error: loadError, mutate } = useSWR<BriefDto>("/api/brief", fetcher);
  const summary = useSWR<BudgetSummaryDto>("/api/budget/summary", fetcher);
  const { me } = useMe();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const missing = loadError instanceof ApiError && loadError.status === 404;
  const tokenUrl =
    data && typeof window !== "undefined"
      ? `${window.location.origin}/api/brief.md?token=${data.token}`
      : "";

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`);
    } catch {
      setError("This browser would not let the page copy — select the text instead.");
    }
  }

  function download() {
    if (!data) return;
    const blob = new Blob([data.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "brief.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function regenerate() {
    setBusy("regenerate");
    setError(null);
    try {
      await apiPost("/api/brief/regenerate");
      toast("Brief regenerated");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not regenerate the brief");
    } finally {
      setBusy(null);
    }
  }

  async function rotate() {
    setBusy("rotate");
    try {
      await apiPost("/api/brief/rotate-token");
      toast("Link rotated — the old one stopped working");
      setConfirmRotate(false);
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rotate the token");
    } finally {
      setBusy(null);
    }
  }

  async function toggleDrive(next: boolean) {
    setBusy("drive");
    setError(null);
    try {
      await apiPost("/api/brief/drive", { enabled: next });
      await mutate();
      toast(next ? "Drive sync on" : "Drive sync off");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change Drive sync");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Brief"
        subtitle={data ? `${data.words} words · ${age(data.generatedAt)}` : "The daily document"}
      />

      {summary.data ? (
        <Card>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <SectionLabel>At a glance</SectionLabel>
            <ForecastPill status={summary.data.status} />
          </div>
          <StackedBar
            paidCents={summary.data.paidCents}
            committedCents={summary.data.committedCents}
            totalCents={summary.data.totalCents}
          />
          <p className="mt-2 text-[13px] text-ink-soft">
            {formatUSD(summary.data.paidCents)} paid · {formatUSD(summary.data.committedCents)}{" "}
            committed · {formatUSD(summary.data.remainingCents)} of{" "}
            {formatUSD(summary.data.totalCents)} left
          </p>
        </Card>
      ) : null}

      <Card>
        <SectionLabel>How to use it</SectionLabel>
        <p className="text-[15px] leading-relaxed text-ink">
          The Brief is everything this app knows about the wedding, written out as one document and
          regenerated nightly. Copy it into a fresh ChatGPT or Claude conversation — or paste the
          link below, which serves the same markdown — and that chat can answer questions about the
          budget, the vendors, the guests and the tasks without any access to the app itself. Anyone
          with the link can read it, so rotate it if it ever goes somewhere it should not.
        </p>
      </Card>

      {error ? <Banner tone="warn">{error}</Banner> : null}

      <Card>
        <SectionLabel>Link for an external chat</SectionLabel>
        {data ? (
          <>
            <p className="mb-3 break-all rounded-lg bg-sunken px-3 py-2 text-[13px] text-ink">
              {tokenUrl}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => copy(tokenUrl, "Link")}>
                Copy link
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirmRotate(true)}>
                Rotate token
              </Button>
            </div>
          </>
        ) : (
          <Skeleton className="h-10 w-full" />
        )}

        {data?.drive.enabled ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Keep a copy in Google Drive</p>
              <p className="text-xs text-ink-soft">
                {data.drive.hasScope
                  ? "Updated each time the Brief regenerates."
                  : "Needs Drive permission — sign in again and approve it."}
              </p>
              {data.drive.lastError ? (
                <p className="text-xs text-danger">{data.drive.lastError}</p>
              ) : null}
            </div>
            <Toggle
              checked={Boolean(data.drive.ownerUserId)}
              disabled={busy === "drive"}
              onChange={toggleDrive}
              label=""
            />
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => data && copy(data.markdown, "Markdown")} disabled={!data}>
          Copy markdown
        </Button>
        <Button variant="secondary" onClick={download} disabled={!data}>
          Download .md
        </Button>
        <Button variant="secondary" onClick={regenerate} disabled={busy === "regenerate"}>
          {busy === "regenerate" ? "Regenerating…" : "Regenerate now"}
        </Button>
      </div>

      {missing ? (
        <EmptyState
          title="No brief yet"
          description="One is generated nightly at 03:00 in the wedding's timezone — or make the first one now."
          action={<Button onClick={regenerate}>Regenerate now</Button>}
        />
      ) : !data ? (
        <Card>
          <Skeleton className="mb-3 h-6 w-64" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="mb-2 h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
        </Card>
      ) : (
        <Card>
          <p className="label-tracked mb-3">
            Generated {longDate(data.generatedAt, me?.timezone)} · {data.trigger.toLowerCase()}
          </p>
          <Markdown source={data.markdown} />
        </Card>
      )}

      <ConfirmDialog
        open={confirmRotate}
        title="Rotate the Brief link?"
        body="The current link stops working immediately. Anywhere you pasted it will need the new one."
        confirmLabel="Rotate"
        danger
        busy={busy === "rotate"}
        onConfirm={rotate}
        onClose={() => setConfirmRotate(false)}
      />
    </div>
  );
}

/** "regenerated just now", "3h old" — the Brief's freshness, in words. */
function age(generatedAt: string): string {
  const relative = relativeShort(generatedAt);
  return relative === "just now" ? "regenerated just now" : `${relative} old`;
}
