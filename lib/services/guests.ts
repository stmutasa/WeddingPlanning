import type { Guest, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import type { GuestSide, RsvpStatus } from "@/lib/types";
import { RSVP_STATUSES, GUEST_SIDES } from "@/lib/types";
import { log } from "./actor";
import { NotFound, ServiceError } from "./errors";

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

const RELATIONS = { events: { include: { event: true } } } satisfies Prisma.GuestInclude;

export type GuestWithEvents = Prisma.GuestGetPayload<{ include: typeof RELATIONS }>;

export type GuestCounts = Record<
  string,
  Partial<Record<RsvpStatus, number>> & { total: number; heads: number }
>;

function fullName(g: { firstName: string; lastName?: string | null }): string {
  return [g.firstName, g.lastName].filter(Boolean).join(" ");
}

export async function create(userId: string, input: GuestInput): Promise<GuestWithEvents> {
  const guest = await db.guest.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName ?? null,
      household: input.household ?? null,
      side: input.side ?? "BOTH",
      email: input.email ?? null,
      phone: input.phone ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      dietary: input.dietary ?? null,
      plusOnes: input.plusOnes ?? 0,
      notes: input.notes ?? null,
    },
    include: RELATIONS,
  });

  await log({
    userId,
    action: "CREATED",
    entityType: "Guest",
    entityId: guest.id,
    summary: `added guest ${fullName(guest)}`,
  });

  return guest;
}

export async function update(
  userId: string,
  id: string,
  input: Partial<GuestInput>
): Promise<GuestWithEvents> {
  const existing = await db.guest.findUnique({ where: { id } });
  if (!existing) throw new NotFound("Guest");

  const guest = await db.guest.update({ where: { id }, data: { ...input }, include: RELATIONS });

  await log({
    userId,
    action: "UPDATED",
    entityType: "Guest",
    entityId: id,
    summary: `updated guest ${fullName(guest)}`,
  });

  return guest;
}

export async function remove(userId: string, id: string): Promise<void> {
  const existing = await db.guest.findUnique({ where: { id } });
  if (!existing) throw new NotFound("Guest");

  await db.guest.delete({ where: { id } });

  await log({
    userId,
    action: "DELETED",
    entityType: "Guest",
    entityId: id,
    summary: `deleted guest ${fullName(existing)}`,
  });
}

export async function list(filters: { q?: string } = {}): Promise<GuestWithEvents[]> {
  return db.guest.findMany({
    where: filters.q
      ? {
          OR: [
            { firstName: { contains: filters.q } },
            { lastName: { contains: filters.q } },
            { household: { contains: filters.q } },
          ],
        }
      : undefined,
    include: RELATIONS,
    orderBy: [{ household: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function setRsvp(
  userId: string,
  guestId: string,
  eventId: string,
  rsvp: RsvpStatus
) {
  const guest = await db.guest.findUnique({ where: { id: guestId } });
  if (!guest) throw new NotFound("Guest");
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new NotFound("Event");

  const row = await db.guestEvent.upsert({
    where: { guestId_eventId: { guestId, eventId } },
    update: { rsvp },
    create: { guestId, eventId, rsvp },
  });

  await log({
    userId,
    action: "UPDATED",
    entityType: "Guest",
    entityId: guestId,
    summary: `set ${fullName(guest)} to ${rsvp.toLowerCase().replace("_", " ")} for ${event.name}`,
  });

  return row;
}

/** Counts per event × RSVP, plus heads (guests + their plus-ones) for YES. */
export async function counts(): Promise<GuestCounts> {
  const [events, rows] = await Promise.all([
    db.event.findMany({ orderBy: { sortOrder: "asc" } }),
    db.guestEvent.findMany({ include: { guest: { select: { plusOnes: true } } } }),
  ]);

  const out: GuestCounts = {};
  for (const e of events) out[e.slug] = { total: 0, heads: 0 };

  const slugById = new Map(events.map((e) => [e.id, e.slug]));
  for (const row of rows) {
    const slug = slugById.get(row.eventId);
    if (!slug) continue;
    const bucket = out[slug];
    const rsvp = row.rsvp as RsvpStatus;
    bucket[rsvp] = (bucket[rsvp] ?? 0) + 1;
    bucket.total += 1;
    if (rsvp === "YES") bucket.heads += 1 + row.guest.plusOnes;
  }

  return out;
}

/** Households where nobody has answered yet — the Brief lists these. */
export async function pendingHouseholds(): Promise<string[]> {
  const guests = await db.guest.findMany({ include: { events: true } });
  const byHousehold = new Map<string, boolean>();
  for (const g of guests) {
    const key = g.household ?? fullName(g);
    const answered = g.events.some((e) => e.rsvp === "YES" || e.rsvp === "NO");
    byHousehold.set(key, (byHousehold.get(key) ?? false) || answered);
  }
  return [...byHousehold.entries()]
    .filter(([, answered]) => !answered)
    .map(([household]) => household)
    .sort();
}

const CSV_ALIASES: Record<keyof GuestInput | "rsvp", string[]> = {
  firstName: ["firstname", "first name", "first", "given name"],
  lastName: ["lastname", "last name", "last", "surname", "family name"],
  household: ["household", "group", "family"],
  side: ["side"],
  email: ["email", "e-mail"],
  phone: ["phone", "mobile", "cell", "telephone"],
  city: ["city", "town"],
  country: ["country"],
  dietary: ["dietary", "diet", "dietary needs", "allergies"],
  plusOnes: ["plusones", "plus ones", "plus-ones", "plus one", "guests"],
  notes: ["notes", "note", "comment"],
  rsvp: ["rsvp", "status"],
};

function pick(row: Record<string, string>, key: keyof typeof CSV_ALIASES): string | null {
  for (const alias of CSV_ALIASES[key]) {
    const found = Object.keys(row).find((k) => k.trim().toLowerCase() === alias);
    if (found && row[found]?.trim()) return row[found].trim();
  }
  return null;
}

export async function importCsv(
  userId: string,
  file: Blob
): Promise<{ imported: number; skipped: number }> {
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) throw new ServiceError("That CSV has no rows");

  const wedding = await db.event.findFirst({ where: { slug: "wedding" } });

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    let firstName = pick(row, "firstName");
    let lastName = pick(row, "lastName");
    if (!firstName) {
      // A single "name" column is common; split on the first space.
      const nameKey = Object.keys(row).find((k) => k.trim().toLowerCase() === "name");
      const whole = nameKey ? row[nameKey]?.trim() : "";
      if (!whole) {
        skipped++;
        continue;
      }
      const [first, ...rest] = whole.split(/\s+/);
      firstName = first;
      lastName = lastName ?? (rest.length ? rest.join(" ") : null);
    }

    const sideRaw = (pick(row, "side") ?? "").toUpperCase();
    const side = (GUEST_SIDES as readonly string[]).includes(sideRaw)
      ? (sideRaw as GuestSide)
      : "BOTH";

    const guest = await db.guest.create({
      data: {
        firstName,
        lastName,
        household: pick(row, "household"),
        side,
        email: pick(row, "email"),
        phone: pick(row, "phone"),
        city: pick(row, "city"),
        country: pick(row, "country"),
        dietary: pick(row, "dietary"),
        plusOnes: Number.parseInt(pick(row, "plusOnes") ?? "0", 10) || 0,
        notes: pick(row, "notes"),
      },
    });

    const rsvpRaw = (pick(row, "rsvp") ?? "").toUpperCase().replace(/\s+/g, "_");
    if (wedding) {
      const rsvp = (RSVP_STATUSES as readonly string[]).includes(rsvpRaw)
        ? (rsvpRaw as RsvpStatus)
        : "NOT_INVITED";
      await db.guestEvent.create({ data: { guestId: guest.id, eventId: wedding.id, rsvp } });
    }

    imported++;
  }

  await log({
    userId,
    action: "CREATED",
    entityType: "Guest",
    summary: `imported ${imported} ${imported === 1 ? "guest" : "guests"} from a CSV`,
  });

  return { imported, skipped };
}

export async function get(id: string): Promise<Guest | null> {
  return db.guest.findUnique({ where: { id }, include: RELATIONS });
}
