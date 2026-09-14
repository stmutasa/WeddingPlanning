"use client";

import type { ReactNode } from "react";
import { Button, Sheet } from "@/components/ui";

/** A yes/no confirm, rendered in the sheet shape the rest of the app uses. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body ? <div className="mb-4 text-sm text-ink-soft">{body}</div> : null}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          className="flex-1"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
