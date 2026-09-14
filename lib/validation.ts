import { z } from "zod";

/** Integer USD cents — never a float. */
export const zCents = z.number().int();

/** Accepts "YYYY-MM-DD" or a full ISO string, always resolves to a Date. */
export const zDate = z.coerce.date();

export const zId = z.string().min(1);

export const zOptionalId = z.string().min(1).nullable().optional();

export const zNonEmpty = z.string().min(1);
