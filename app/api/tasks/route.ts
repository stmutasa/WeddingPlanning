import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { zDate, zOptionalId } from "@/lib/validation";
import { TASK_PRIORITIES } from "@/lib/types";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1),
  notes: z.string().nullable().optional(),
  dueDate: zDate.nullable().optional(),
  eventId: zOptionalId,
  assigneeId: zOptionalId,
  priority: z.enum(TASK_PRIORITIES).optional(),
  milestone: z.boolean().optional(),
});

export async function GET(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const eventId = searchParams.get("eventId");

  const tasks = await db.task.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(eventId ? { eventId } : {}),
    },
    include: { event: true, assignee: true },
    orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }],
  });
  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    const task = await db.task.create({
      data: { ...body, createdById: session.id },
    });

    await recordActivity({
      userId: session.id,
      action: "CREATED",
      entityType: "Task",
      entityId: task.id,
      summary: `${session.name ?? "Someone"} added the task ${task.title}`,
    });

    return NextResponse.json(task, { status: 201 });
  });
}
