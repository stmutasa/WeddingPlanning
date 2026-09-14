import { NotImplemented } from "./errors";

/**
 * DESIGN.md §2: fetches/caches open.er-api.com rates in FxRate per
 * (base, quote, day). Returns "1 unit of `quote` = N USD".
 */
export async function rate(_day: string, _quote: string): Promise<number> {
  throw new NotImplemented("fx.rate");
}
