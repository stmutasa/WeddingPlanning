import { Chip } from "@/components/ui";
import { asEventSlug } from "./attribution";

/** Filled event chip (DESIGN.md §5.1): 12% tint, event-colour text, radius 6. */
export function EventChip({
  slug,
  name,
  className,
}: {
  slug: string | null | undefined;
  name: string;
  className?: string;
}) {
  return (
    <Chip kind="event" slug={asEventSlug(slug)} className={className}>
      {name}
    </Chip>
  );
}
