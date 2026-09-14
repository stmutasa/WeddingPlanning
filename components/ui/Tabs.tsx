"use client";

import { clsx } from "@/lib/clsx";

export interface TabItem {
  value: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={clsx(
        "flex gap-1 overflow-x-auto rounded-lg bg-sunken p-1",
        className
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={clsx(
              "focus-ring min-h-9 flex-1 whitespace-nowrap rounded-md px-3 text-[13px] font-semibold transition-colors",
              active ? "bg-primary text-on-primary" : "text-ink-soft"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
