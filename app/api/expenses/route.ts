import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { zCents, zDate, zOptionalId } from "@/lib/validation";
import { EXPENSE_SOURCES } from "@/lib/types";
import * as expenses from "@/lib/services/expenses";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    description: z.string().min(1),
    amountCents: zCents.optional(),
    originalAmount: z.number().positive().optional(),
    originalCurrency: z.string().length(3).optional(),
    fxRate: z.number().positive().optional(),
    date: zDate,
    eventId: z.string().min(1),
    categoryId: zOptionalId,
    vendorId: zOptionalId,
    funderId: z.string().min(1),
    source: z.enum(EXPENSE_SOURCES).optional(),
    notes: z.string().nullable().optional(),
    paymentDueId: zOptionalId,
  })
  .refine((v) => v.amountCents != null || (v.originalAmount != null && v.originalCurrency != null), {
    message: "Provide amountCents, or originalAmount together with originalCurrency",
  });

export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const value = (key: string) => searchParams.get(key) ?? undefined;
  const when = (key: string) => {
    const raw = searchParams.get(key);
    return raw ? new Date(raw) : undefined;
  };

  const result = await expenses.list({
    eventId: value("eventId"),
    categoryId: value("categoryId"),
    vendorId: value("vendorId"),
    funderId: value("funderId"),
    source: value("source"),
    q: value("q"),
    from: when("from"),
    to: when("to"),
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    // The service resolves FX when originalCurrency is not USD and no rate
    // was given, links a PaymentDue, and appends the Activity row.
    const expense = await expenses.create(session.id, body);
    return NextResponse.json(expense, { status: 201 });
  });
}
