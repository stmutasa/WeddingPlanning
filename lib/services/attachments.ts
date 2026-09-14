import type { Attachment } from "@prisma/client";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/uploads";
import type { AttachmentKind } from "@/lib/types";
import { log } from "./actor";
import { NotFound } from "./errors";

/**
 * Receipts, quotes and contracts. Bytes go to `UPLOAD_DIR` on the volume
 * and only the path is stored (DESIGN.md §2: never blobs in SQLite).
 */

export interface AttachInput {
  file: Blob;
  originalName: string;
  kind: AttachmentKind;
  expenseId?: string | null;
  vendorId?: string | null;
  /** AI transcription for search, when the receipt scan already read it. */
  extractedText?: string | null;
}

export async function attach(userId: string, input: AttachInput): Promise<Attachment> {
  const [expense, vendor] = await Promise.all([
    input.expenseId ? db.expense.findUnique({ where: { id: input.expenseId } }) : null,
    input.vendorId ? db.vendor.findUnique({ where: { id: input.vendorId } }) : null,
  ]);
  if (input.expenseId && !expense) throw new NotFound("Expense");
  if (input.vendorId && !vendor) throw new NotFound("Vendor");

  const { relativePath, bytes } = await saveUpload(input.file, input.originalName);

  const attachment = await db.attachment.create({
    data: {
      expenseId: input.expenseId ?? null,
      vendorId: input.vendorId ?? null,
      kind: input.kind,
      path: relativePath,
      mime: input.file.type || "application/octet-stream",
      bytes,
      extractedText: input.extractedText ?? null,
    },
  });

  await log({
    userId,
    action: "CREATED",
    entityType: expense ? "Expense" : "Vendor",
    entityId: input.expenseId ?? input.vendorId ?? null,
    summary: `attached a ${input.kind.toLowerCase()} to ${expense?.description ?? vendor?.name ?? "the wedding"}`,
  });

  return attachment;
}

export async function get(id: string): Promise<Attachment | null> {
  return db.attachment.findUnique({ where: { id } });
}

export async function remove(userId: string, id: string): Promise<void> {
  const existing = await db.attachment.findUnique({
    where: { id },
    include: { expense: true, vendor: true },
  });
  if (!existing) throw new NotFound("Attachment");

  await db.attachment.delete({ where: { id } });

  await log({
    userId,
    action: "DELETED",
    entityType: existing.expenseId ? "Expense" : "Vendor",
    entityId: existing.expenseId ?? existing.vendorId ?? null,
    summary: `removed a ${existing.kind.toLowerCase()} from ${existing.expense?.description ?? existing.vendor?.name ?? "the wedding"}`,
  });
}
