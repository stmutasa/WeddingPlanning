"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiGet, apiPatch, fetcher } from "@/lib/api";
import { useAppSettings } from "@/lib/hooks";
import { relativeShort } from "@/lib/dates";
import { AI_EFFORTS, type AiEffort, type AiProvider } from "@/lib/types";
import type { AiModelsDto, AiUsageDto } from "@/lib/api-types";
import { Button, Card, Input, SectionLabel, Select, Tabs, Toggle, useToast } from "@/components/ui";
import { Banner, CardSkeleton } from "@/components/common";

/**
 * Settings › AI (DESIGN.md §6): the live model lists grouped by provider,
 * the resolved primary and where it came from, the free-text override for
 * an id newer than the cache, effort and tone, and the usage tiles.
 */
export function AiCard() {
  const { appSettings, mutate } = useAppSettings();
  const models = useSWR<AiModelsDto>("/api/ai/models", fetcher);
  const [usageWindow, setUsageWindow] = useState("30d");
  const usage = useSWR<AiUsageDto>(`/api/ai/usage?window=${usageWindow}`, fetcher);
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [override, setOverride] = useState("");
  const [saving, setSaving] = useState(false);

  if (!appSettings) return <CardSkeleton />;

  async function patch(body: Record<string, unknown>, message = "Saved") {
    setSaving(true);
    try {
      await apiPatch("/api/settings/app", body);
      await mutate();
      await models.mutate();
      toast(message);
    } finally {
      setSaving(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await apiGet<AiModelsDto>("/api/ai/models?refresh=1");
      await models.mutate();
      toast("Model list refreshed");
    } finally {
      setRefreshing(false);
    }
  }

  const openai = models.data?.openai ?? [];
  const anthropic = models.data?.anthropic ?? [];

  function modelSelect(
    label: string,
    provider: AiProvider,
    value: string,
    onChange: (provider: AiProvider, model: string) => void,
  ) {
    const known = [...openai.map((m) => m.id), ...anthropic.map((m) => m.id)];
    return (
      <Select
        label={label}
        value={known.includes(value) ? `${provider}:${value}` : ""}
        onChange={(e) => {
          const [nextProvider, ...rest] = e.target.value.split(":");
          onChange(nextProvider as AiProvider, rest.join(":"));
        }}
      >
        <option value="">{value ? `${value} (not in the list)` : "Choose a model"}</option>
        <optgroup label="OpenAI">
          {openai.map((model) => (
            <option key={model.id} value={`openai:${model.id}`}>
              {model.displayName || model.id}
            </option>
          ))}
        </optgroup>
        <optgroup label="Anthropic">
          {anthropic.map((model) => (
            <option key={model.id} value={`anthropic:${model.id}`}>
              {model.displayName || model.id}
            </option>
          ))}
        </optgroup>
      </Select>
    );
  }

  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-3">
        <SectionLabel>AI</SectionLabel>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-ink-soft">{appSettings.aiEnabled ? "On" : "Off"}</span>
          <Toggle
            checked={appSettings.aiEnabled}
            disabled={saving}
            onChange={(checked) => patch({ aiEnabled: checked }, checked ? "AI on" : "AI off")}
          />
        </span>
      </div>

      {models.data?.problem ? (
        <Banner tone="warn" className="mb-3">
          {models.data.problem}
        </Banner>
      ) : null}

      <div className="flex flex-col gap-3">
        <div>
          {modelSelect(
            "Primary model",
            appSettings.aiPrimaryProvider,
            appSettings.aiPrimaryModel,
            (provider, model) =>
              patch({ aiPrimaryProvider: provider, aiPrimaryModel: model }, "Primary model set"),
          )}
          <p className="mt-1 text-xs text-ink-soft">
            {models.data?.primary
              ? `Running ${models.data.primary.model} on ${models.data.primary.provider}`
              : "No usable primary model — check the key on the server."}
            {models.data?.resolvedFrom === "match"
              ? " · resolved from “astra”"
              : models.data?.resolvedFrom === "env"
                ? " · from AI_MODEL"
                : models.data?.resolvedFrom === "user"
                  ? " · picked here"
                  : ""}
          </p>
        </div>

        {modelSelect(
          "Backup model",
          appSettings.aiBackupProvider,
          appSettings.aiBackupModel,
          (provider, model) =>
            patch({ aiBackupProvider: provider, aiBackupModel: model }, "Backup model set"),
        )}

        <div className="flex items-end gap-2">
          <Input
            className="flex-1"
            label="Model id not in the list"
            placeholder="gpt-astra-6"
            value={override}
            onChange={(e) => setOverride(e.target.value)}
          />
          <Button
            variant="secondary"
            className="mb-0.5"
            disabled={!override.trim() || saving}
            onClick={() => {
              patch({ aiPrimaryModel: override.trim() }, "Primary model set");
              setOverride("");
            }}
          >
            Use it
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-soft">
            {models.data?.fetchedAt
              ? `List as of ${relativeShort(models.data.fetchedAt)} ago`
              : "List not fetched yet"}
          </p>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Reasoning effort"
            value={appSettings.aiReasoning}
            onChange={(e) => patch({ aiReasoning: e.target.value as AiEffort }, "Effort set")}
          >
            {AI_EFFORTS.map((effort) => (
              <option key={effort} value={effort}>
                {effort}
              </option>
            ))}
          </Select>
          <Input
            label="Tone"
            defaultValue={appSettings.assistantTone}
            onBlur={(e) =>
              e.target.value.trim() && e.target.value !== appSettings.assistantTone
                ? patch({ assistantTone: e.target.value.trim() }, "Tone set")
                : undefined
            }
          />
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <SectionLabel>Usage</SectionLabel>
          <Tabs
            className="w-auto"
            value={usageWindow}
            onChange={setUsageWindow}
            items={[
              { value: "24h", label: "24h" },
              { value: "7d", label: "7d" },
              { value: "30d", label: "30d" },
              { value: "all", label: "All" },
            ]}
          />
        </div>

        {usage.data ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Tile label="Calls" value={String(usage.data.totals.calls)} />
              <Tile
                label="Tokens"
                value={(
                  usage.data.totals.inputTokens + usage.data.totals.outputTokens
                ).toLocaleString("en-US")}
              />
              <Tile label="Est. cost" value={cost(usage.data.totals.costMicros)} />
            </div>

            {usage.data.fellBackCalls > 0 ? (
              <p className="mt-2 text-xs text-ink-soft">
                {usage.data.fellBackCalls} of those fell back to the backup model.
              </p>
            ) : null}

            {usage.data.byFeature.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Breakdown title="By feature" rows={usage.data.byFeature} />
                <Breakdown title="By model" rows={usage.data.byModel} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">No model calls in this window.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-soft">Loading usage…</p>
        )}
      </div>
    </Card>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-sunken px-3 py-2">
      <p className="label-tracked">{label}</p>
      <p className="text-[18px] font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: AiUsageDto["byFeature"] }) {
  return (
    <div>
      <p className="label-tracked mb-1">{title}</p>
      <ul className="flex flex-col gap-1 text-[13px]">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-ink-soft">{row.key.toLowerCase()}</span>
            <span className="shrink-0 tabular-nums text-ink">
              {row.calls} · {cost(row.costMicros)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Micro-dollars from the rate table; null means the model has no price on file. */
function cost(costMicros: number | null): string {
  if (costMicros == null) return "n/a";
  const dollars = costMicros / 1_000_000;
  return dollars < 0.01 && dollars > 0 ? "<$0.01" : `$${dollars.toFixed(2)}`;
}
