import type { Guest } from "@prisma/client";
import type { GuestSide, RsvpStatus } from "@/lib/types";
import { NotImplemented } from "./errors";

export interface GuestInput {
  firstName: string;
  lastName?: string | null;
  household?: string | null;
  side?: GuestSide;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  dietary?: string | null;
  plusOnes?: number;
  notes?: string | null;
}

export interface GuestCounts {
  [eventSlug: string]: Partial<Record<RsvpStatus, number>>;
}

export async function create(_userId: string, _input: GuestInput): Promise<Guest> {
  throw new NotImplemented("guests.create");
}

export async function update(
  _userId: string,
  _id: string,
  _input: Partial<GuestInput>
): Promise<Guest> {
  throw new NotImplemented("guests.update");
}

export async function remove(_userId: string, _id: string): Promise<void> {
  throw new NotImplemented("guests.delete");
}

export async function counts(): Promise<GuestCounts> {
  throw new NotImplemented("guests.counts");
}

export async function importCsv(_userId: string, _file: Blob): Promise<{ imported: number }> {
  throw new NotImplemented("guests.importCsv");
}
