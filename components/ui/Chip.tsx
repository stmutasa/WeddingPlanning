import type { ReactNode } from "react";
import type { EventSlug, Hue } from "@/lib/types";
import { clsx } from "@/lib/clsx";
import { HueDot } from "./HueDot";
import { StatusPill, type SemanticStatus } from "./StatusPill";

const EVENT_CLASSES: Record<EventSlug, string> = {
  ruracio: "bg-ev-ruracio/12 text-ev-ruracio",
  wedding: "bg-ev-wedding/12 text-ev-wedding",
  honeymoon: "bg-ev-honeymoon/12 text-ev-honeymoon",
  party: "bg-ev-party/12 text-ev-party",
  general: "bg-ev-general/12 text-ev-general",
};

const PERSON_CLASSES: Record<Hue, string> = {
  pink: "bg-hue-pink/12 text-hue-pink",
  teal: "bg-hue-teal/12 text-hue-teal",
  violet: "bg-hue-violet/12 text-hue-violet",
  orange: "bg-hue-orange/12 text-hue-orange",
  green: "bg-hue-green/12 text-hue-green",
  blue: "bg-hue-blue/12 text-hue-blue",
  red: "bg-hue-red/12 text-hue-red",
  amber: "bg-hue-amber/12 text-hue-amber",
};

type ChipProps =
  | { kind: "event"; slug: EventSlug; children: ReactNode; className?: string }
  | { kind: "person"; hue: Hue; children: ReactNode; className?: string }
  | { kind: "semantic"; status: SemanticStatus; children: ReactNode; className?: string };

/**
 * Colour has exactly three attribution jobs here (DESIGN.md §5.1):
 * event chips are filled + radius 6, person chips are filled + pill radius
 * with a hue dot, semantic chips are outlined pills with a glyph.
 */
export function Chip(props: ChipProps) {
  if (props.kind === "event") {
    return (
      <span
        className={clsx(
          "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
          EVENT_CLASSES[props.slug],
          props.className
        )}
      >
        {props.children}
      </span>
    );
  }

  if (props.kind === "person") {
    return (
      <span
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
          PERSON_CLASSES[props.hue],
          props.className
        )}
      >
        <HueDot hue={props.hue} />
        {props.children}
      </span>
    );
  }

  return (
    <StatusPill status={props.status} className={props.className}>
      {props.children}
    </StatusPill>
  );
}
