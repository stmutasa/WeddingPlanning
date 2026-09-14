"use client";

import { useRef, useState } from "react";
import { apiPost, apiPut, apiUpload } from "@/lib/api";
import { downscaleImage, isPdf } from "@/lib/image";
import { useAiEnabled } from "@/lib/hooks";
import { isDisabled, type MaybeDisabled, type ReceiptDto, type VendorDto } from "@/lib/api-types";
import type { ExpenseDraft } from "@/lib/expense-draft";
import { Button, useToast } from "@/components/ui";
import { Banner } from "@/components/common";
import type { CatalogBundle } from "./types";
import { ExpenseFields } from "./ExpenseFields";

/**
 * DESIGN.md §6 "Photo": camera or file, downscaled to 1600px JPEG with the
 * EXIF rotation baked in before it leaves the phone, read by PROMPTS.md §2,
 * then shown as a prefilled form with the thumbnail. Nothing is saved until
 * the person confirms. A quote or invoice that states instalments also
 * offers "Create vendor + payment schedule".
 */
export function PhotoTab({
  draft,
  onChange,
  catalog,
  onSave,
  saving,
  onFile,
}: {
  draft: ExpenseDraft;
  onChange: (patch: Partial<ExpenseDraft>) => void;
  catalog: CatalogBundle;
  onSave: (source: string) => void;
  saving: boolean;
  /** The downscaled file, attached to the expense after it saves. */
  onFile: (file: File | null) => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [aiRefused, setAiRefused] = useState(false);
  const ai = useAiEnabled();
  const aiOff = aiRefused || (ai.ready && !ai.enabled);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ReceiptDto["draft"]["schedule"]>([]);
  const [merchant, setMerchant] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setSchedule([]);
    let upload = file;
    try {
      if (!isPdf(file)) {
        const shrunk = await downscaleImage(file);
        setPreview(shrunk.previewUrl);
        upload = new File([shrunk.blob], "receipt.jpg", { type: "image/jpeg" });
      } else {
        setPreview(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That photo could not be read");
      return;
    }
    onFile(upload);

    if (aiOff) return;

    setReading(true);
    try {
      const form = new FormData();
      form.append("file", upload);
      const result = await apiUpload<MaybeDisabled<ReceiptDto>>("/api/ai/receipt", form);
      if (isDisabled(result)) {
        setAiRefused(true);
        return;
      }
      const r = result.resolved;
      setMerchant(result.draft.merchant);
      setSchedule(r.offersSchedule ? result.draft.schedule : []);
      onChange({
        description:
          result.draft.merchant ?? result.draft.lineItems[0]?.description ?? draft.description,
        amount: r.originalAmount != null ? String(r.originalAmount) : draft.amount,
        currency: r.originalCurrency || "USD",
        fxRate: r.fxRate != null ? String(r.fxRate) : "",
        date: r.date || draft.date,
        eventId: r.eventId ?? draft.eventId,
        categoryId: r.categoryId ?? draft.categoryId,
        vendorId: r.vendorId ?? draft.vendorId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That receipt could not be read");
    } finally {
      setReading(false);
    }
  }

  async function createVendorAndSchedule() {
    setScheduling(true);
    try {
      let vendorId = draft.vendorId;
      if (!vendorId) {
        const vendor = await apiPost<VendorDto>("/api/vendors", {
          name: merchant ?? draft.description ?? "New vendor",
          eventId: draft.eventId || null,
          categoryId: draft.categoryId || null,
          status: "QUOTED",
        });
        vendorId = vendor.id;
        onChange({ vendorId });
      }
      const rate = Number(draft.fxRate);
      const usesRate = draft.currency.toUpperCase() !== "USD" && rate > 0;
      const items = schedule
        .filter((item) => item.amount != null && item.dueDate)
        .map((item) => ({
          label: item.label || "Instalment",
          dueDate: item.dueDate as string,
          amountCents: Math.round((item.amount as number) * (usesRate ? rate : 1) * 100),
        }));
      if (items.length === 0) {
        toast("That document has no dated instalments to schedule");
        return;
      }
      await apiPut(`/api/vendors/${vendorId}/payments`, { items });
      toast(`Scheduled ${items.length} payment${items.length === 1 ? "" : "s"}`);
      setSchedule([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the schedule");
    } finally {
      setScheduling(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => inputRef.current?.click()}>
          {preview ? "Replace photo" : "Take or choose a photo"}
        </Button>
      </div>

      {preview ? (
        <div className="flex items-center gap-3">
          {/* A blob: URL from the canvas downscale — next/image has nothing
              to optimise here and cannot take a blob src. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Receipt"
            width={64}
            height={64}
            className="card-frame h-16 w-16 rounded-lg object-cover"
          />
          <p className="text-xs text-ink-soft">
            Downscaled to 1600px before upload. It is attached to the expense when you save.
          </p>
        </div>
      ) : null}

      {reading ? <Banner tone="info">Reading the receipt…</Banner> : null}
      {error ? <Banner tone="warn">{error}</Banner> : null}
      {aiOff ? (
        <Banner tone="info">
          The assistant is off, so the photo is attached as-is — fill the details in below.
        </Banner>
      ) : null}

      {schedule.length > 0 ? (
        <div className="card-frame rounded-lg bg-sunken p-3">
          <p className="label-tracked mb-2">Instalments found</p>
          <ul className="mb-3 flex flex-col gap-1 text-sm text-ink">
            {schedule.map((item, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  {item.label}
                  {item.dueDate ? ` · ${item.dueDate}` : ""}
                </span>
                <span className="tabular-nums">
                  {item.amount != null ? `${draft.currency.toUpperCase()} ${item.amount}` : "—"}
                </span>
              </li>
            ))}
          </ul>
          <Button size="sm" onClick={createVendorAndSchedule} disabled={scheduling}>
            {scheduling ? "Working…" : "Create vendor + payment schedule"}
          </Button>
        </div>
      ) : null}

      <ExpenseFields
        draft={draft}
        onChange={onChange}
        events={catalog.events}
        categories={catalog.categories}
        funders={catalog.funders}
        vendors={catalog.vendors}
      />

      <Button onClick={() => onSave("RECEIPT")} disabled={saving}>
        {saving ? "Saving…" : "Save expense"}
      </Button>
    </div>
  );
}
