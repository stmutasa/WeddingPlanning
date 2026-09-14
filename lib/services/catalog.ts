import type { Category, Contribution, Event, Funder } from "@prisma/client";
import { db } from "@/lib/db";
import type { FunderKind } from "@/lib/types";
import { log, money } from "./actor";
import { Conflict, NotFound, ServiceError } from "./errors";

/**
 * The small reference tables behind the money model: events, categories,
 * funders and family contributions. They are CRUD, but they are still
 * writes, so they live here and append an `Activity` row like everything
 * else (CLAUDE.md: "All writes go through lib/services/*").
 */

// ------------------------------------------------------------------ events

export interface EventInput {
  slug: string;
  name: string;
  date?: Date | null;
  budgetCents?: number;
  color?: string | null;
  sortOrder?: number;
  notes?: string | null;
}

export const events = {
  async list(): Promise<Event[]> {
    return db.event.findMany({ orderBy: { sortOrder: "asc" } });
  },

  async get(id: string): Promise<Event | null> {
    return db.event.findUnique({ where: { id } });
  },

  async bySlug(slug: string): Promise<Event | null> {
    return db.event.findUnique({ where: { slug } });
  },

  async create(userId: string, input: EventInput): Promise<Event> {
    const event = await db.event.create({
      data: {
        slug: input.slug,
        name: input.name,
        date: input.date ?? null,
        budgetCents: input.budgetCents ?? 0,
        color: input.color ?? null,
        sortOrder: input.sortOrder ?? 0,
        notes: input.notes ?? null,
      },
    });
    await log({
      userId,
      action: "CREATED",
      entityType: "Event",
      entityId: event.id,
      summary: `added the event ${event.name}`,
    });
    return event;
  },

  async update(userId: string, id: string, input: Partial<EventInput>): Promise<Event> {
    const existing = await db.event.findUnique({ where: { id } });
    if (!existing) throw new NotFound("Event");

    const event = await db.event.update({ where: { id }, data: { ...input } });
    await log({
      userId,
      action: "UPDATED",
      entityType: "Event",
      entityId: id,
      summary:
        input.budgetCents != null && input.budgetCents !== existing.budgetCents
          ? `set the ${event.name} envelope to ${money(event.budgetCents)}`
          : `updated ${event.name}`,
    });
    return event;
  },

  async remove(userId: string, id: string): Promise<void> {
    const existing = await db.event.findUnique({ where: { id } });
    if (!existing) throw new NotFound("Event");
    if (existing.locked) throw new Conflict("This event cannot be deleted");

    await db.event.delete({ where: { id } });
    await log({
      userId,
      action: "DELETED",
      entityType: "Event",
      entityId: id,
      summary: `deleted the event ${existing.name}`,
    });
  },
};

// -------------------------------------------------------------- categories

export const categories = {
  async list(): Promise<Category[]> {
    return db.category.findMany({ orderBy: { sortOrder: "asc" } });
  },

  async create(
    userId: string,
    input: { name: string; icon?: string | null; sortOrder?: number }
  ): Promise<Category> {
    const category = await db.category.create({
      data: { name: input.name, icon: input.icon ?? null, sortOrder: input.sortOrder ?? 0 },
    });
    await log({
      userId,
      action: "CREATED",
      entityType: "Category",
      entityId: category.id,
      summary: `added the category ${category.name}`,
    });
    return category;
  },

  async update(
    userId: string,
    id: string,
    input: { name?: string; icon?: string | null; sortOrder?: number }
  ): Promise<Category> {
    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) throw new NotFound("Category");

    const category = await db.category.update({ where: { id }, data: { ...input } });
    await log({
      userId,
      action: "UPDATED",
      entityType: "Category",
      entityId: id,
      summary: `updated the category ${category.name}`,
    });
    return category;
  },

  async remove(userId: string, id: string): Promise<void> {
    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) throw new NotFound("Category");

    await db.category.delete({ where: { id } });
    await log({
      userId,
      action: "DELETED",
      entityType: "Category",
      entityId: id,
      summary: `deleted the category ${existing.name}`,
    });
  },
};

// ----------------------------------------------------------------- funders

export const funders = {
  async list(includeArchived = false): Promise<Funder[]> {
    return db.funder.findMany({
      where: includeArchived ? undefined : { archived: false },
      orderBy: { name: "asc" },
    });
  },

  async create(userId: string, input: { name: string; kind: FunderKind }): Promise<Funder> {
    if (input.kind === "USER") {
      throw new ServiceError("USER funders are created automatically on sign-in");
    }
    const funder = await db.funder.create({ data: { name: input.name, kind: input.kind } });
    await log({
      userId,
      action: "CREATED",
      entityType: "Funder",
      entityId: funder.id,
      summary: `added the funder ${funder.name}`,
    });
    return funder;
  },

  async update(
    userId: string,
    id: string,
    input: { name?: string; archived?: boolean }
  ): Promise<Funder> {
    const existing = await db.funder.findUnique({ where: { id } });
    if (!existing) throw new NotFound("Funder");

    const funder = await db.funder.update({ where: { id }, data: { ...input } });
    await log({
      userId,
      action: "UPDATED",
      entityType: "Funder",
      entityId: id,
      summary:
        input.archived === true
          ? `archived the funder ${funder.name}`
          : `updated the funder ${funder.name}`,
    });
    return funder;
  },
};

// ----------------------------------------------------------- contributions

export const contributions = {
  async list(funderId?: string) {
    return db.contribution.findMany({
      where: funderId ? { funderId } : undefined,
      include: { funder: true },
      orderBy: { date: "desc" },
    });
  },

  async create(
    userId: string,
    input: { funderId: string; amountCents: number; date: Date; note?: string | null }
  ): Promise<Contribution> {
    const funder = await db.funder.findUnique({ where: { id: input.funderId } });
    if (!funder) throw new NotFound("Funder");

    const contribution = await db.contribution.create({
      data: {
        funderId: input.funderId,
        amountCents: input.amountCents,
        date: input.date,
        note: input.note ?? null,
      },
    });
    await log({
      userId,
      action: "CREATED",
      entityType: "Contribution",
      entityId: contribution.id,
      summary: `logged a contribution from ${funder.name}, ${money(input.amountCents)}`,
    });
    return contribution;
  },

  async remove(userId: string, id: string): Promise<void> {
    const existing = await db.contribution.findUnique({ where: { id }, include: { funder: true } });
    if (!existing) throw new NotFound("Contribution");

    await db.contribution.delete({ where: { id } });
    await log({
      userId,
      action: "DELETED",
      entityType: "Contribution",
      entityId: id,
      summary: `removed a contribution from ${existing.funder.name}`,
    });
  },
};

// ------------------------------------------------------------ budget lines

export const budgetLines = {
  async list(eventId?: string) {
    return db.budgetLine.findMany({
      where: eventId ? { eventId } : undefined,
      include: { category: true, event: true },
      orderBy: [{ event: { sortOrder: "asc" } }, { category: { sortOrder: "asc" } }],
    });
  },

  async create(
    userId: string,
    input: {
      eventId: string;
      categoryId: string;
      plannedCents: number;
      note?: string | null;
      source?: "USER" | "AI";
    }
  ) {
    const [event, category] = await Promise.all([
      db.event.findUnique({ where: { id: input.eventId } }),
      db.category.findUnique({ where: { id: input.categoryId } }),
    ]);
    if (!event) throw new NotFound("Event");
    if (!category) throw new NotFound("Category");

    const line = await db.budgetLine.create({
      data: {
        eventId: input.eventId,
        categoryId: input.categoryId,
        plannedCents: input.plannedCents,
        note: input.note ?? null,
        source: input.source ?? "USER",
      },
      include: { category: true, event: true },
    });
    await log({
      userId,
      action: "CREATED",
      entityType: "BudgetLine",
      entityId: line.id,
      summary: `planned ${money(line.plannedCents)} for ${event.name} ${category.name}`,
    });
    return line;
  },

  async update(
    userId: string,
    id: string,
    input: { plannedCents?: number; note?: string | null }
  ) {
    const existing = await db.budgetLine.findUnique({
      where: { id },
      include: { category: true, event: true },
    });
    if (!existing) throw new NotFound("Budget line");

    const line = await db.budgetLine.update({
      where: { id },
      data: { ...input },
      include: { category: true, event: true },
    });
    await log({
      userId,
      action: "UPDATED",
      entityType: "BudgetLine",
      entityId: id,
      summary: `changed the ${line.event.name} ${line.category.name} plan to ${money(line.plannedCents)}`,
    });
    return line;
  },

  async remove(userId: string, id: string): Promise<void> {
    const existing = await db.budgetLine.findUnique({
      where: { id },
      include: { category: true, event: true },
    });
    if (!existing) throw new NotFound("Budget line");

    await db.budgetLine.delete({ where: { id } });
    await log({
      userId,
      action: "DELETED",
      entityType: "BudgetLine",
      entityId: id,
      summary: `removed the ${existing.event.name} ${existing.category.name} plan`,
    });
  },
};
