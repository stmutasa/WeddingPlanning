/**
 * DESIGN.md §7: "Cost from a rate table... OpenAI rows filled in by Simi
 * when he confirms the model id; unpriced -> costMicros = null, shown as
 * 'n/a'." Prices are USD per million tokens (MTok); costMicros is USD
 * micro-dollars (1 USD = 1,000,000 micros), so `tokens * pricePerMTok`
 * already gives micros directly (tokens/1e6 * price, times 1e6 to get
 * micros, cancels to tokens * price).
 */

export interface ModelRate {
  inputPerMTok: number;
  outputPerMTok: number;
}

// Keyed by a lowercase substring of the model id.
export const RATE_TABLE: Record<string, ModelRate> = {
  "claude-opus-5": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-sonnet-5": { inputPerMTok: 2, outputPerMTok: 10 },
  "claude-haiku-4.5": { inputPerMTok: 1, outputPerMTok: 5 },
  // OpenAI rows: left unpriced until Simi confirms the resolved model id.
};

function findRate(model: string): ModelRate | null {
  const key = model.toLowerCase();
  for (const [needle, rate] of Object.entries(RATE_TABLE)) {
    if (key.includes(needle)) return rate;
  }
  return null;
}

/** Returns micro-dollars, or null when the model has no rate on file ("n/a" in the UI). */
export function computeCostMicros(
  model: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const rate = findRate(model);
  if (!rate) return null;
  return Math.round(inputTokens * rate.inputPerMTok + outputTokens * rate.outputPerMTok);
}
