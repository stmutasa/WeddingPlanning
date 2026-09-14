import { NotImplemented } from "./errors";

/** PROMPTS.md §7 — one model call for both users; per-user push text differs only in the greeting. */
export async function weekly(): Promise<void> {
  throw new NotImplemented("digest.weekly");
}
