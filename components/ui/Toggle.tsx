"use client";

import { clsx } from "@/lib/clsx";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function Toggle({ checked, onChange, label, disabled, id }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className={clsx(
        "inline-flex items-center gap-2",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      )}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          "focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-sunken"
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-card transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>
      {label ? <span className="text-sm text-ink">{label}</span> : null}
    </label>
  );
}
