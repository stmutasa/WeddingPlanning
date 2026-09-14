import type { Prisma, Vendor } from "@prisma/client";
import { db } from "@/lib/db";
import type { VendorStatus } from "@/lib/types";
import { log } from "./actor";
import { NotFound } from "./errors";

export interface VendorInput {
  name: string;
  categoryId?: string | null;
  eventId?: string | null;
  status?: VendorStatus;
  contactName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  address?: string | null;
  quotedCents?: number | null;
  quotedOriginalAmount?: number | null;
  quotedOriginalCurrency?: string | null;
  contractSummary?: string | null;
  notes?: string | null;
  rating?: number | null;
}

const RELATIONS = { category: true, event: true } satisfies Prisma.VendorInclude;

export type VendorWithRelations = Prisma.VendorGetPayload<{ include: typeof RELATIONS }>;

export async function create(userId: string, input: VendorInput): Promise<VendorWithRelations> {
  const vendor = await db.vendor.create({
    data: {
      name: input.name,
      categoryId: input.categoryId ?? null,
      eventId: input.eventId ?? null,
      status: input.status ?? "CONSIDERING",
      contactName: input.contactName ?? null,
      phone: input.phone ?? null,
      whatsapp: input.whatsapp ?? null,
      email: input.email ?? null,
      website: input.website ?? null,
      instagram: input.instagram ?? null,
      address: input.address ?? null,
      quotedCents: input.quotedCents ?? null,
      quotedOriginalAmount: input.quotedOriginalAmount ?? null,
      quotedOriginalCurrency: input.quotedOriginalCurrency ?? null,
      contractSummary: input.contractSummary ?? null,
      notes: input.notes ?? null,
      rating: input.rating ?? null,
    },
    include: RELATIONS,
  });

  await log({
    userId,
    action: "CREATED",
    entityType: "Vendor",
    entityId: vendor.id,
    summary: `added vendor ${vendor.name}`,
  });

  return vendor;
}

export async function update(
  userId: string,
  id: string,
  input: Partial<VendorInput>
): Promise<VendorWithRelations> {
  const existing = await db.vendor.findUnique({ where: { id } });
  if (!existing) throw new NotFound("Vendor");

  const vendor = await db.vendor.update({
    where: { id },
    data: { ...input },
    include: RELATIONS,
  });

  await log({
    userId,
    action: "UPDATED",
    entityType: "Vendor",
    entityId: vendor.id,
    summary:
      input.status && input.status !== existing.status
        ? `marked ${vendor.name} ${input.status.toLowerCase()}`
        : `updated vendor ${vendor.name}`,
  });

  return vendor;
}

export async function remove(userId: string, id: string): Promise<void> {
  const existing = await db.vendor.findUnique({ where: { id } });
  if (!existing) throw new NotFound("Vendor");

  await db.vendor.delete({ where: { id } });

  await log({
    userId,
    action: "DELETED",
    entityType: "Vendor",
    entityId: id,
    summary: `deleted vendor ${existing.name}`,
  });
}

export async function list(filters: {
  status?: VendorStatus | string;
  eventId?: string;
  q?: string;
}): Promise<VendorWithRelations[]> {
  return db.vendor.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.eventId ? { eventId: filters.eventId } : {}),
      ...(filters.q ? { name: { contains: filters.q } } : {}),
    },
    include: RELATIONS,
    orderBy: { name: "asc" },
  });
}

export async function get(id: string) {
  return db.vendor.findUnique({
    where: { id },
    include: {
      ...RELATIONS,
      payments: { orderBy: { dueDate: "asc" } },
      attachments: true,
      expenses: { orderBy: { date: "desc" } },
    },
  });
}

export async function setStatus(
  userId: string,
  id: string,
  status: VendorStatus
): Promise<Vendor> {
  return update(userId, id, { status });
}

/** Vendors with their quoted total, what has been paid, and the next due date. */
export async function withMoney(): Promise<
  (VendorWithRelations & { paidCents: number; nextDue: { label: string; dueDate: Date; amountCents: number } | null })[]
> {
  const vendors = await db.vendor.findMany({
    include: {
      ...RELATIONS,
      expenses: { select: { amountCents: true } },
      payments: { where: { status: "OPEN" }, orderBy: { dueDate: "asc" } },
    },
    orderBy: [{ event: { sortOrder: "asc" } }, { name: "asc" }],
  });

  return vendors.map((v) => {
    const { expenses, payments, ...rest } = v;
    const next = payments[0];
    return {
      ...rest,
      paidCents: expenses.reduce((t, e) => t + e.amountCents, 0),
      nextDue: next
        ? { label: next.label, dueDate: next.dueDate, amountCents: next.amountCents }
        : null,
    };
  });
}
