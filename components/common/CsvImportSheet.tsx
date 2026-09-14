"use client";

import { useRef, useState } from "react";
import { ApiError, apiUpload } from "@/lib/api";
import { Button, Select, Sheet, useToast } from "@/components/ui";
import { Banner } from "./Banner";

interface MappingState {
  headers: string[];
  needs: string[];
}

/**
 * CSV import, shared by the transactions inbox and the guest list. The
 * transactions route answers `400 { error, headers, needs }` when it cannot
 * tell which column is which (README's API catalog), so the sheet shows a
 * column-mapping step and re-posts; the guest route matches by alias and
 * never asks.
 */
export function CsvImportSheet({
  open,
  onClose,
  endpoint,
  title = "Import CSV",
  help,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  endpoint: string;
  title?: string;
  help?: string;
  onDone?: (result: Record<string, unknown>) => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<MappingState | null>(null);
  const [columns, setColumns] = useState<Record<string, string>>({});
  const [amountSign, setAmountSign] = useState("positive-is-spend");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setMapping(null);
    setColumns({});
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function upload(chosen: File, withMapping: boolean) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", chosen);
      if (withMapping) {
        for (const [key, value] of Object.entries(columns)) {
          if (value) form.append(key, value);
        }
        form.append("amountSign", amountSign);
      }
      const result = await apiUpload<Record<string, unknown>>(endpoint, form);
      const imported = Number(result.imported ?? 0);
      const duplicates = Number(result.duplicates ?? 0);
      toast(
        `Imported ${imported} ${imported === 1 ? "row" : "rows"}${duplicates ? ` · ${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped` : ""}`,
      );
      onDone?.(result);
      reset();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.body.headers)) {
        setMapping({
          headers: err.body.headers as string[],
          needs: (err.body.needs as string[]) ?? ["dateColumn", "nameColumn", "amountColumn"],
        });
        setError("Tell us which column is which, then import again.");
      } else {
        setError(err instanceof Error ? err.message : "That import failed");
      }
    } finally {
      setBusy(false);
    }
  }

  const NEED_LABELS: Record<string, string> = {
    dateColumn: "Date column",
    nameColumn: "Description column",
    amountColumn: "Amount column",
    merchantColumn: "Merchant column (optional)",
    currencyColumn: "Currency column (optional)",
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={title}
    >
      <div className="flex flex-col gap-3">
        {help ? <p className="text-sm text-ink-soft">{help}</p> : null}

        <label className="label-tracked" htmlFor="csv-file">
          CSV file
        </label>
        <input
          id="csv-file"
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="focus-ring min-h-11 rounded-lg bg-sunken px-3 py-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-wide file:text-on-primary"
          onChange={(e) => {
            const chosen = e.target.files?.[0] ?? null;
            setFile(chosen);
            setMapping(null);
            setError(null);
          }}
        />

        {error ? <Banner tone="warn">{error}</Banner> : null}

        {mapping ? (
          <div className="flex flex-col gap-3">
            {[...mapping.needs, "merchantColumn", "currencyColumn"]
              .filter((need, index, all) => all.indexOf(need) === index)
              .map((need) => (
                <Select
                  key={need}
                  label={NEED_LABELS[need] ?? need}
                  value={columns[need] ?? ""}
                  onChange={(e) => setColumns((prev) => ({ ...prev, [need]: e.target.value }))}
                >
                  <option value="">—</option>
                  {mapping.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </Select>
              ))}
            <Select
              label="Money out is"
              value={amountSign}
              onChange={(e) => setAmountSign(e.target.value)}
            >
              <option value="positive-is-spend">A positive amount</option>
              <option value="negative-is-spend">A negative amount</option>
            </Select>
          </div>
        ) : null}

        <Button disabled={!file || busy} onClick={() => file && upload(file, Boolean(mapping))}>
          {busy ? "Importing…" : mapping ? "Import with this mapping" : "Import"}
        </Button>
      </div>
    </Sheet>
  );
}
