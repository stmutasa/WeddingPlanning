"use client";

import { useId, type SelectHTMLAttributes } from "react";
import { clsx } from "@/lib/clsx";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, id, className, children, ...rest }: SelectProps) {
  // A label has to point at a real id, so one is generated when the
  // caller gives neither an id nor a name (accessibility, DESIGN.md §5.7).
  const generatedId = useId();
  const selectId = id ?? rest.name ?? generatedId;
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={selectId} className="label-tracked">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className={clsx(
          "focus-ring min-h-11 rounded-lg border-2 border-transparent bg-sunken px-3 text-[15px] text-ink focus:border-[var(--input-focus-border)]",
          error && "border-danger",
          className
        )}
        {...rest}
      >
        {children}
      </select>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
