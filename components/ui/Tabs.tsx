"use client";

import { useEffect, useRef } from "react";
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
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Six tabs do not fit a 390px screen, so the strip scrolls. The selected
  // tab is nudged into view by moving the strip's own scrollLeft —
  // `scrollIntoView` would scroll the whole page as well, which jumps the
  // screen on load.
  useEffect(() => {
    const strip = stripRef.current;
    const tab = activeRef.current;
    if (!strip || !tab) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left < strip.scrollLeft) strip.scrollLeft = Math.max(0, left - 8);
    else if (right > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = right - strip.clientWidth + 8;
    }
  }, [value]);

  return (
    <div
      ref={stripRef}
      role="tablist"
      className={clsx("flex gap-1 overflow-x-auto rounded-lg bg-sunken p-1", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={active ? activeRef : undefined}
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
