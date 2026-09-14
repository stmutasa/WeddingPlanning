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
      {/* The switch reads as 24px tall but the button it lives in is 44,
          so the tap target meets DESIGN.md §5.7. */}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label ? undefined : "Toggle"}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <span
          className={clsx(
            "relative block h-6 w-11 rounded-full transition-colors",
            checked ? "bg-primary" : "bg-sunken"
          )}
        >
          <span
            className={clsx(
              "absolute top-0.5 h-5 w-5 rounded-full bg-card transition-transform",
              checked ? "translate-x-[22px]" : "translate-x-0.5"
            )}
          />
        </span>
      </button>
      {label ? <span className="text-sm text-ink">{label}</span> : null}
    </label>
  );
}
