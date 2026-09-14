"use client";

import { useEffect, type ReactNode } from "react";
import { clsx } from "@/lib/clsx";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

/** Bottom sheet: slide up, radius 16 top corners, shadow-sheet, drag handle. */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          "animate-slide-up relative z-10 w-full max-w-lg rounded-t-2xl bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-sheet",
          className
        )}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        {title ? (
          <h2 className="mb-3 font-display text-[18px] font-bold text-ink">{title}</h2>
        ) : null}
        {children}
      </div>
    </div>
  );
}
