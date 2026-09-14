"use client";

import { useMemo, useState } from "react";
import { apiPost, apiUpload } from "@/lib/api";
import { useCatalog, useRefreshAll } from "@/lib/hooks";
import { emptyDraft, draftProblem, toBody, type ExpenseDraft } from "@/lib/expense-draft";
import { formatUSD } from "@/lib/money/format";
import type { ExpenseDto } from "@/lib/api-types";
import { Button, Sheet, Tabs, useToast } from "@/components/ui";
import { Banner } from "@/components/common";
import { ExpenseFields } from "./ExpenseFields";
import { TypeTab } from "./TypeTab";
import { PhotoTab } from "./PhotoTab";

/**
 * The ＋ sheet, reachable from every screen (DESIGN.md §6). Three tabs over
 * one draft: type it, photograph it, or fill the form. After a save the
 * toast reads "Saved · Wedding · $1,200 · Simi".
 */
export function CaptureSheet({
  open,
  onClose,
  defaultFunderId,
}: {
  open: boolean;
  onClose: () => void;
  defaultFunderId: string | null;
}) {
  const [tab, setTab] = useState("type");
  const [draft, setDraft] = useState<ExpenseDraft>(() =>
    emptyDraft({ funderId: defaultFunderId ?? "" }),
  );
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const catalog = useCatalog();
  const { toast } = useToast();
  const refreshAll = useRefreshAll();

  // A fresh draft per opening comes from the key AppShell gives this
  // component, not from an effect that re-syncs state after the fact.
  const bundle = useMemo(
    () => ({
      events: catalog.events,
      categories: catalog.categories,
      funders: catalog.funders,
      vendors: catalog.vendors,
      people: catalog.people,
    }),
    [catalog.events, catalog.categories, catalog.funders, catalog.vendors, catalog.people],
  );

  function patch(next: Partial<ExpenseDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  async function save(source: string) {
    const problem = draftProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const expense = await apiPost<ExpenseDto>("/api/expenses", toBody(draft, source));
      if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", "RECEIPT");
        await apiUpload(`/api/expenses/${expense.id}/attachments`, form);
      }
      const funder = catalog.funders.find((f) => f.id === expense.funderId);
      toast(
        `Saved · ${expense.event?.name ?? ""} · ${formatUSD(expense.amountCents)} · ${funder?.name ?? ""}`,
      );
      refreshAll();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add an expense"
      className="max-h-[92vh] overflow-y-auto"
    >
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

      {error ? (
        <Banner tone="danger" className="mb-3">
          {error}
        </Banner>
      ) : null}

      {tab === "type" ? (
        <TypeTab draft={draft} onChange={patch} catalog={bundle} onSave={save} saving={saving} />
      ) : null}

      {tab === "photo" ? (
        <PhotoTab
          draft={draft}
          onChange={patch}
          catalog={bundle}
          onSave={save}
          saving={saving}
          onFile={setFile}
        />
      ) : null}

      {tab === "form" ? (
        <div className="flex flex-col gap-3">
          <ExpenseFields
            draft={draft}
            onChange={patch}
            events={catalog.events}
            categories={catalog.categories}
            funders={catalog.funders}
            vendors={catalog.vendors}
          />
          <AttachmentPicker onFile={setFile} file={file} />
          <Button onClick={() => save("MANUAL")} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}

function AttachmentPicker({
  file,
  onFile,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-tracked">Attachment (optional)</span>
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className="focus-ring min-h-11 rounded-lg bg-sunken px-3 py-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-wide file:text-on-primary"
      />
      {file ? (
        <span className="text-xs text-ink-soft">{file.name} attaches after saving.</span>
      ) : null}
    </label>
  );
}
