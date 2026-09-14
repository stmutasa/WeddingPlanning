import type { Hue } from "@/lib/types";
import { clsx } from "@/lib/clsx";

const HUE_BG: Record<Hue, string> = {
  pink: "bg-hue-pink",
  teal: "bg-hue-teal",
  violet: "bg-hue-violet",
  orange: "bg-hue-orange",
  green: "bg-hue-green",
  blue: "bg-hue-blue",
  red: "bg-hue-red",
  amber: "bg-hue-amber",
};

export interface HueDotProps {
  hue: Hue;
  size?: number;
  className?: string;
}

/** A small solid dot for attribution (who paid / who added / assignee). */
export function HueDot({ hue, size = 8, className }: HueDotProps) {
  return (
    <span
      aria-hidden
      className={clsx("inline-block shrink-0 rounded-full", HUE_BG[hue], className)}
      style={{ width: size, height: size }}
    />
  );
}
