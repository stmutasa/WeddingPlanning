import { clsx } from "@/lib/clsx";

export interface KangaBandProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

/** The kanga stripe (DESIGN.md §5.3/§5.4): decorative, aria-hidden. */
export function KangaBand({ orientation = "horizontal", className }: KangaBandProps) {
  return (
    <div
      aria-hidden
      className={clsx(
        orientation === "horizontal" ? "kanga-band" : "kanga-band-vertical",
        className
      )}
    />
  );
}
