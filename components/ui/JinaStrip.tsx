"use client";

import { useState } from "react";
import { jinaOfTheDay } from "@/lib/jina";
import { Sheet } from "./Sheet";

/** Home-only proverb strip (DESIGN.md §5.3): tap opens the translation. */
export function JinaStrip() {
  const [open, setOpen] = useState(false);
  const jina = jinaOfTheDay();

  return (
    <>
      <button onClick={() => setOpen(true)} className="focus-ring w-full py-2 text-center">
        <span className="jina-text">{jina.swahili}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Today's jina">
        <p className="mb-2 font-display text-[15px] font-bold text-ink">{jina.swahili}</p>
        <p className="mb-4 text-sm text-ink-soft">{jina.translation}</p>
        <p className="text-sm text-ink-soft">
          Every kanga cloth carries a proverb, a jina — a small piece of wisdom worn every day. This
          one rotates daily, in the same spirit: a reminder about the ledger this app keeps.
        </p>
      </Sheet>
    </>
  );
}
