"use client";

import { useId, type InputHTMLAttributes } from "react";
import { clsx } from "@/lib/clsx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, className, ...rest }: InputProps) {
  // A label has to point at a real id, so one is generated when the
  // caller gives neither an id nor a name (accessibility, DESIGN.md §5.7).
  const generatedId = useId();
  const inputId = id ?? rest.name ?? generatedId;
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={inputId} className="label-tracked">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={clsx(
          "focus-ring min-h-11 rounded-lg border-2 border-transparent bg-sunken px-3 text-[15px] text-ink placeholder:text-ink-soft focus:border-[var(--input-focus-border)]",
          error && "border-danger",
          className
        )}
        {...rest}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
