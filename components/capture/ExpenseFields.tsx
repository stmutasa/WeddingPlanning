"use client";

import { Input, Select, Textarea, Money } from "@/components/ui";
import { CURRENCIES, previewCents, type ExpenseDraft } from "@/lib/expense-draft";
import type { CategoryDto, EventDto, FunderDto, VendorDto } from "@/lib/api-types";

/**
 * The manual expense form (DESIGN.md §6 "Form" tab), shared by the capture
 * sheet, the expense detail sheet and "Mark paid". Original currency and
 * rate are always editable so a KES receipt keeps its audit trail.
 */
export function ExpenseFields({
  draft,
  onChange,
  events,
  categories,
  funders,
  vendors,
  compact,
}: {
  draft: ExpenseDraft;
  onChange: (patch: Partial<ExpenseDraft>) => void;
  events: EventDto[];
  categories: CategoryDto[];
  funders: FunderDto[];
  vendors: VendorDto[];
  compact?: boolean;
}) {
  const foreign = draft.currency.toUpperCase() !== "USD";
  const preview = foreign ? previewCents(draft) : null;

  return (
    <div className="flex flex-col gap-3">
      <Input
        name="description"
        label="Description"
        placeholder="Florist deposit"
        value={draft.description}
        onChange={(e) => onChange({ description: e.target.value })}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          name="amount"
          label={`Amount (${draft.currency.toUpperCase()})`}
          inputMode="decimal"
          placeholder="0.00"
          value={draft.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
        />
        <Select
          name="currency"
          label="Currency"
          value={draft.currency}
          onChange={(e) => onChange({ currency: e.target.value })}
        >
          {CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </Select>
      </div>

      {foreign ? (
        <div className="flex flex-col gap-1">
          <Input
            name="fxRate"
            label={`Rate · 1 ${draft.currency.toUpperCase()} in USD`}
            inputMode="decimal"
            placeholder="Leave blank for today's rate"
            value={draft.fxRate}
            onChange={(e) => onChange({ fxRate: e.target.value })}
          />
          <p className="text-xs text-ink-soft">
            {preview != null ? (
              <>
                Stored as <Money cents={preview} detail />
              </>
            ) : (
              "Stored in USD; leave the rate blank and today's rate is used."
            )}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Select
          name="eventId"
          label="Event"
          value={draft.eventId}
          onChange={(e) => onChange({ eventId: e.target.value })}
        >
          <option value="">Choose an event</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </Select>
        <Input
          name="date"
          label="Date"
          type="date"
          value={draft.date}
          onChange={(e) => onChange({ date: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select
          name="categoryId"
          label="Category"
          value={draft.categoryId}
          onChange={(e) => onChange({ categoryId: e.target.value })}
        >
          <option value="">No category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
        <Select
          name="funderId"
          label="Paid by"
          value={draft.funderId}
          onChange={(e) => onChange({ funderId: e.target.value })}
        >
          <option value="">Choose who paid</option>
          {funders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </div>

      <Select
        name="vendorId"
        label="Vendor"
        value={draft.vendorId}
        onChange={(e) => onChange({ vendorId: e.target.value })}
      >
        <option value="">No vendor</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </Select>

      {compact ? null : (
        <Textarea
          name="notes"
          label="Notes (optional)"
          rows={2}
          value={draft.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      )}
    </div>
  );
}
