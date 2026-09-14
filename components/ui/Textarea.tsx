"use client";

import { useId, type TextareaHTMLAttributes } from "react";
import { clsx } from "@/lib/clsx";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, id, className, ...rest }: TextareaProps) {
  // A label has to point at a real id, so one is generated when the
  // caller gives neither an id nor a name (accessibility, DESIGN.md §5.7).
  const generatedId = useId();
  const areaId = id ?? rest.name ?? generatedId;
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={areaId} className="label-tracked">
          {label}
        </label>
      ) : null}
      <textarea
        id={areaId}
        className={clsx(
          "focus-ring min-h-24 rounded-lg border-2 border-transparent bg-sunken px-3 py-2 text-[15px] text-ink placeholder:text-ink-soft focus:border-[var(--input-focus-border)]",
          error && "border-danger",
          className
        )}
        {...rest}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
