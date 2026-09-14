import type { Prisma, Task } from "@prisma/client";
import { db } from "@/lib/db";
import type { TaskPriority, TaskStatus } from "@/lib/types";
import { log } from "./actor";
import { NotFound } from "./errors";

export interface TaskInput {
  title: string;
  notes?: string | null;
  dueDate?: Date | null;
  eventId?: string | null;
  assigneeId?: string | null;
  priority?: TaskPriority;
  milestone?: boolean;
  source?: "USER" | "AI";
}

const RELATIONS = {
  event: true,
  assignee: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof RELATIONS }>;

export async function create(userId: string, input: TaskInput): Promise<TaskWithRelations> {
  const last = await db.task.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });

  const task = await db.task.create({
    data: {
      title: input.title,
      notes: input.notes ?? null,
      dueDate: input.dueDate ?? null,
      eventId: input.eventId ?? null,
      assigneeId: input.assigneeId ?? null,
      priority: input.priority ?? "P2",
      milestone: input.milestone ?? false,
      source: input.source ?? "USER",
      sortOrder: (last?.sortOrder ?? 0) + 1,
      createdById: userId,
    },
    include: RELATIONS,
  });

  await log({
    userId,
    action: "CREATED",
    entityType: "Task",
    entityId: task.id,
    summary: `added task "${task.title}"`,
  });

  return task;
}

export async function update(
  userId: string,
  id: string,
  input: Partial<TaskInput> & { status?: TaskStatus }
): Promise<TaskWithRelations> {
  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) throw new NotFound("Task");

  const statusChanged = input.status != null && input.status !== existing.status;

  const task = await db.task.update({
    where: { id },
    data: {
      ...input,
      ...(statusChanged
        ? { completedAt: input.status === "DONE" ? new Date() : null }
        : {}),
    },
    include: RELATIONS,
  });

  await log({
    userId,
    action: "UPDATED",
    entityType: "Task",
    entityId: id,
    summary: statusChanged
      ? input.status === "DONE"
        ? `completed "${task.title}"`
        : `reopened "${task.title}"`
      : `updated task "${task.title}"`,
  });

  return task;
}

export async function remove(userId: string, id: string): Promise<void> {
  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) throw new NotFound("Task");

  await db.task.delete({ where: { id } });

  await log({
    userId,
    action: "DELETED",
    entityType: "Task",
    entityId: id,
    summary: `deleted task "${existing.title}"`,
  });
}

export async function list(filters: {
  status?: string;
  eventId?: string;
  assigneeId?: string;
}): Promise<TaskWithRelations[]> {
  return db.task.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.eventId ? { eventId: filters.eventId } : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    },
    include: RELATIONS,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { sortOrder: "asc" }],
  });
}

export async function reorder(ids: string[]): Promise<void> {
  await db.$transaction(
    ids.map((id, index) => db.task.update({ where: { id }, data: { sortOrder: index } }))
  );
}

/** Open counts per event slug, for the Brief's section 9. */
export async function openCountByEvent(): Promise<{ eventName: string; count: number }[]> {
  const rows = await db.task.groupBy({
    by: ["eventId"],
    where: { status: "OPEN" },
    _count: { _all: true },
  });
  const events = await db.event.findMany();
  const nameById = new Map(events.map((e) => [e.id, e.name]));
  return rows
    .map((r) => ({ eventName: r.eventId ? (nameById.get(r.eventId) ?? "—") : "No event", count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

export interface GeneratedTask {
  title: string;
  eventSlug: string | null;
  dueDate: string;
  priority: TaskPriority;
  milestone: boolean;
  notes: string | null;
  suggestedAssignee: "annette" | "simi" | null;
}

/**
 * Writes the model's timeline draft (PROMPTS.md §6). Idempotent: any title
 * that already exists, case-insensitively, is skipped rather than
 * duplicated, so "Generate timeline" can be run twice safely.
 */
export async function applyTimeline(
  userId: string,
  drafted: GeneratedTask[]
): Promise<{ created: Task[]; skipped: number }> {
  const [existing, events, users] = await Promise.all([
    db.task.findMany({ select: { title: true } }),
    db.event.findMany(),
    db.user.findMany({ include: { settings: true } }),
  ]);

  const have = new Set(existing.map((t) => t.title.trim().toLowerCase()));
  const eventBySlug = new Map(events.map((e) => [e.slug, e.id]));
  const userByName = new Map(
    users.map((u) => [(u.settings?.displayName ?? u.name ?? "").toLowerCase(), u.id])
  );

  let sortOrder = (await db.task.findFirst({ orderBy: { sortOrder: "desc" } }))?.sortOrder ?? 0;
  const created: Task[] = [];
  let skipped = 0;

  for (const t of drafted) {
    const key = t.title.trim().toLowerCase();
    if (have.has(key)) {
      skipped++;
      continue;
    }
    have.add(key);
    sortOrder += 1;
    created.push(
      await db.task.create({
        data: {
          title: t.title.trim(),
          notes: t.notes,
          dueDate: parseDay(t.dueDate),
          eventId: t.eventSlug ? (eventBySlug.get(t.eventSlug) ?? null) : null,
          assigneeId: t.suggestedAssignee ? (userByName.get(t.suggestedAssignee) ?? null) : null,
          priority: t.priority,
          milestone: t.milestone,
          source: "AI",
          sortOrder,
          createdById: userId,
        },
      })
    );
  }

  if (created.length > 0) {
    await log({
      userId,
      action: "CREATED",
      entityType: "Task",
      summary: `generated ${created.length} timeline ${created.length === 1 ? "task" : "tasks"}`,
    });
  }

  return { created, skipped };
}

function parseDay(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
