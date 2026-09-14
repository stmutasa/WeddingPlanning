import type { Hue } from "@/lib/types";
import { Chip, HueDot } from "@/components/ui";

/** Round person chip; falls back to plain text when the funder is not a person. */
export function PersonChip({
  name,
  hue,
  className,
}: {
  name: string;
  hue: Hue | null;
  className?: string;
}) {
  if (!hue) {
    return (
      <span className={`text-[11px] font-semibold text-ink-soft ${className ?? ""}`}>{name}</span>
    );
  }
  return (
    <Chip kind="person" hue={hue} className={className}>
      {name}
    </Chip>
  );
}

export function PersonDotName({ name, hue }: { name: string; hue: Hue | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
      {hue ? <HueDot hue={hue} /> : null}
      {name}
    </span>
  );
}
