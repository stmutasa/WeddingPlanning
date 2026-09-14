/**
 * Display formatting for integer-cent USD amounts. Whole dollars show with
 * no decimals ("$43,580"); amounts under $100 always show cents so small
 * numbers stay precise ("$43,580.25" style also used whenever `detail` is
 * requested, e.g. an expense row or an edit form).
 */
export function formatUSD(cents: number, opts?: { detail?: boolean }): string {
  const dollars = cents / 100;
  const showCents = Boolean(opts?.detail) || Math.abs(cents) < 10_000;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
}

/** Signed variant, e.g. for "+$120" / "-$120" settle-up lines. */
export function formatUSDSigned(cents: number, opts?: { detail?: boolean }): string {
  const formatted = formatUSD(Math.abs(cents), opts);
  if (cents > 0) return `+${formatted}`;
  if (cents < 0) return `-${formatted}`;
  return formatted;
}

/**
 * Secondary KES line shown under a USD amount when a receipt/quote was in
 * KES, e.g. "≈ KES 104,200". `usdToKesRate` is "1 USD = rate KES".
 */
export function formatKESSecondary(usdCents: number, usdToKesRate: number): string {
  const kes = (usdCents / 100) * usdToKesRate;
  return `≈ KES ${Math.round(kes).toLocaleString("en-US")}`;
}

/** Formats an original-currency amount as printed on a receipt, e.g. "KES 15,000". */
export function formatOriginal(amount: number, currency: string): string {
  if (currency === "USD") {
    return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
  }
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
