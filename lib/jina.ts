/**
 * The jina list (DESIGN.md §5.5) — Swahili proverbs, one per day, with the
 * first one as the app's motto on the login screen. Plain module, not a
 * client component: a "use client" file's exports reach a server component
 * as client references, not as the values themselves, and the login page is
 * a server component.
 *
 * Annette is still to confirm the wording (CONTEXT.md §3).
 */
export interface Jina {
  swahili: string;
  translation: string;
}

export const JINA_LIST: Jina[] = [
  {
    swahili: "Mali bila daftari hupotea bila habari",
    translation: "Wealth without a ledger disappears without notice.",
  },
  { swahili: "Haba na haba hujaza kibaba", translation: "Little by little fills the measure." },
  { swahili: "Akiba haiozi", translation: "Savings do not rot." },
  { swahili: "Pole pole ndio mwendo", translation: "Slowly is the way to go." },
  { swahili: "Subira huvuta heri", translation: "Patience draws blessings." },
  { swahili: "Bandu bandu humaliza gogo", translation: "Chip by chip finishes the log." },
  { swahili: "Umoja ni nguvu", translation: "Unity is strength." },
  { swahili: "Penye nia ipo njia", translation: "Where there is a will there is a way." },
  { swahili: "Haraka haraka haina baraka", translation: "Hurry has no blessing." },
  { swahili: "Mchagua jembe si mkulima", translation: "One who is fussy about hoes is no farmer." },
  {
    swahili: "Chema chajiuza, kibaya chajitembeza",
    translation: "A good thing sells itself; a bad thing advertises itself.",
  },
  {
    swahili: "Mgaagaa na upwa hali wali mkavu",
    translation: "One who forages the shore does not eat dry rice.",
  },
];

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((now - start) / 86_400_000);
}

/** Rotates daily by day-of-year (DESIGN.md §5.3). */
export function jinaOfTheDay(date = new Date()): Jina {
  return JINA_LIST[dayOfYear(date) % JINA_LIST.length];
}

/** The motto: shown on first run and on the login screen. */
export const MOTTO: Jina = JINA_LIST[0];
