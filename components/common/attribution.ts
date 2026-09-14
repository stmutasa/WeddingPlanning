import type { EventSlug, Hue } from "@/lib/types";
import { KNOWN_EVENT_SLUGS, type FunderDto, type PersonDto } from "@/lib/api-types";

/**
 * Events are editable (DESIGN.md §1), so a slug the design system has no
 * colour for falls back to General rather than crashing a lookup.
 */
export function asEventSlug(slug: string | null | undefined): EventSlug {
  return KNOWN_EVENT_SLUGS.includes(slug as EventSlug) ? (slug as EventSlug) : "general";
}

/**
 * Person colour is attribution and nothing else (DESIGN.md §5.1). A funder
 * that is one of the two people wears their chosen hue; Joint and family
 * money is not a person, so it gets no hue and no chip.
 */
export function hueForFunder(funder: Pick<FunderDto, "userId" | "kind">, people: PersonDto[]): Hue | null {
  if (funder.kind !== "USER" || !funder.userId) return null;
  return people.find((p) => p.userId === funder.userId)?.hue ?? null;
}

export function hueForUser(userId: string | null | undefined, people: PersonDto[]): Hue | null {
  if (!userId) return null;
  return people.find((p) => p.userId === userId)?.hue ?? null;
}

export function personName(userId: string | null | undefined, people: PersonDto[]): string | null {
  if (!userId) return null;
  return people.find((p) => p.userId === userId)?.name ?? null;
}
