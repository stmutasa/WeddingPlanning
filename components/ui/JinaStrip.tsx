"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";

// DESIGN.md §5.5 — Annette to confirm wording (CONTEXT.md §3.2 open item).
export const JINA_LIST: { swahili: string; translation: string }[] = [
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

export function jinaOfTheDay(date = new Date()) {
  return JINA_LIST[dayOfYear(date) % JINA_LIST.length];
}

/** Home-only proverb strip (DESIGN.md §5.3): tap opens the translation. */
export function JinaStrip() {
  const [open, setOpen] = useState(false);
  const jina = jinaOfTheDay();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="focus-ring w-full py-2 text-center"
      >
        <span className="jina-text">{jina.swahili}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Today's jina">
        <p className="mb-2 font-display text-[15px] font-bold text-ink">{jina.swahili}</p>
        <p className="mb-4 text-sm text-ink-soft">{jina.translation}</p>
        <p className="text-sm text-ink-soft">
          Every kanga cloth carries a proverb, a jina — a small piece of wisdom worn every day.
          {"  "}This one rotates daily, in the same spirit: a reminder about the ledger this app keeps.
        </p>
      </Sheet>
    </>
  );
}
