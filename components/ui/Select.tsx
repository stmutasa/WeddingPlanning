import type { SelectHTMLAttributes } from "react";
import { clsx } from "@/lib/clsx";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, id, className, children, ...rest }: SelectProps) {
  const selectId = id ?? rest.name;
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
