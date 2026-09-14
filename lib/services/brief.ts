import type { BriefSnapshot } from "@prisma/client";
import type { BriefTrigger } from "@/lib/types";
import { NotImplemented } from "./errors";

/**
 * DESIGN.md §8: builds the 15-section markdown deterministically from the
 * DB, adds the model-written "State of play" paragraph (PROMPTS.md §8),
 * stores a BriefSnapshot, prunes to the last 30, and updates the Drive file
 * when FEATURE_DRIVE_BRIEF sync is on.
 */
export async function generate(_trigger: BriefTrigger): Promise<BriefSnapshot> {
  throw new NotImplemented("brief.generate");
}

export async function latest(): Promise<BriefSnapshot | null> {
  throw new NotImplemented("brief.latest");
}
