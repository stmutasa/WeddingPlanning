import type { Vendor } from "@prisma/client";
import type { VendorStatus } from "@/lib/types";
import { NotImplemented } from "./errors";

export interface VendorInput {
  name: string;
  categoryId?: string | null;
  eventId?: string | null;
  contactName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  address?: string | null;
  quotedCents?: number | null;
  notes?: string | null;
  rating?: number | null;
}

/** app/api/vendors currently does plain CRUD directly; Phase B moves it here. */
export async function create(_userId: string, _input: VendorInput): Promise<Vendor> {
  throw new NotImplemented("vendors.create");
}

export async function update(
  _userId: string,
  _id: string,
  _input: Partial<VendorInput>
): Promise<Vendor> {
  throw new NotImplemented("vendors.update");
}

export async function remove(_userId: string, _id: string): Promise<void> {
  throw new NotImplemented("vendors.delete");
}

export async function list(_filters: { status?: VendorStatus; eventId?: string }): Promise<Vendor[]> {
  throw new NotImplemented("vendors.list");
}

export async function setStatus(
  _userId: string,
  _id: string,
  _status: VendorStatus
): Promise<Vendor> {
  throw new NotImplemented("vendors.setStatus");
}
