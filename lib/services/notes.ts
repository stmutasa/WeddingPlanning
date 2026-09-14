import type { Note } from "@prisma/client";
import { db } from "@/lib/db";
import type { NoteKind } from "@/lib/types";
import { log } from "./actor";
import { NotFound } from "./errors";

export interface NoteInput {
  kind?: NoteKind;
  title?: string | null;
  body: string;
  pinned?: boolean;
}

function label(note: { kind: string; title: string | null; body: string }): string {
  const name = note.title?.trim() || note.body.trim().slice(0, 40);
  return note.kind === "NOTE" ? `note "${name}"` : `${note.kind.toLowerCase()} "${name}"`;
}

export async function create(userId: string, input: NoteInput): Promise<Note> {
  const note = await db.note.create({
    data: {
      kind: input.kind ?? "NOTE",
      title: input.title ?? null,
      body: input.body,
      pinned: input.pinned ?? false,
      createdById: userId,
    },
  });

  await log({
    userId,
    action: "CREATED",
    entityType: "Note",
    entityId: note.id,
    summary: `added a ${label(note)}`,
  });

  return note;
}

export async function update(
  userId: string,
  id: string,
  input: Partial<NoteInput>
): Promise<Note> {
  const existing = await db.note.findUnique({ where: { id } });
  if (!existing) throw new NotFound("Note");

  const note = await db.note.update({ where: { id }, data: { ...input } });

  await log({
    userId,
    action: "UPDATED",
    entityType: "Note",
    entityId: id,
    summary: `updated a ${label(note)}`,
  });

  return note;
}

export async function remove(userId: string, id: string): Promise<void> {
  const existing = await db.note.findUnique({ where: { id } });
  if (!existing) throw new NotFound("Note");

  await db.note.delete({ where: { id } });

  await log({
    userId,
    action: "DELETED",
    entityType: "Note",
    entityId: id,
    summary: `deleted a ${label(existing)}`,
  });
}

export async function list(filters: { kind?: NoteKind | string } = {}): Promise<Note[]> {
  return db.note.findMany({
    where: filters.kind ? { kind: filters.kind } : undefined,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
}

/**
 * The digest is stored as a `Note` of kind `DIGEST` so the Home card can
 * read it back without a new table (DESIGN.md §4 leaves the store open;
 * `DIGEST` is registered in `lib/types.ts`).
 */
export async function latestOfKind(kind: NoteKind): Promise<Note | null> {
  return db.note.findFirst({ where: { kind }, orderBy: { createdAt: "desc" } });
}
