import type { Note } from "@prisma/client";
import type { NoteKind } from "@/lib/types";
import { NotImplemented } from "./errors";

export interface NoteInput {
  kind?: NoteKind;
  title?: string | null;
  body: string;
  pinned?: boolean;
}

export async function create(_userId: string, _input: NoteInput): Promise<Note> {
  throw new NotImplemented("notes.create");
}

export async function update(
  _userId: string,
  _id: string,
  _input: Partial<NoteInput>
): Promise<Note> {
  throw new NotImplemented("notes.update");
}

export async function remove(_userId: string, _id: string): Promise<void> {
  throw new NotImplemented("notes.delete");
}
