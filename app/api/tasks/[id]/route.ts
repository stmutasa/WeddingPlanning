import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import { zDate, zOptionalId } from "@/lib/validation";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/types";
import * as tasks from "@/lib/services/tasks";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  dueDate: zDate.nullable().optional(),
  eventId: zOptionalId,
  assigneeId: zOptionalId,
  priority: z.enum(TASK_PRIORITIES).optional(),
  milestone: z.boolean().optional(),
  status: z.enum(TASK_STATUSES).optional(),
});

export async function GET(_request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { id } = await ctx.params;
  const task = await db.task.findUnique({ where: { id }, include: { event: true, assignee: true } });
  if (!task) return apiError("Task not found", 404);
  return NextResponse.json(task);
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const task = await tasks.update(session.id, id, body);
    return NextResponse.json(task);
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    await tasks.remove(session.id, id);
    return NextResponse.json({ ok: true });
  });
}
