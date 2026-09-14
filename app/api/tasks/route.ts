import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { zDate, zOptionalId } from "@/lib/validation";
import { TASK_PRIORITIES } from "@/lib/types";
import * as tasks from "@/lib/services/tasks";

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
  return NextResponse.json(
    await tasks.list({
      status: searchParams.get("status") ?? undefined,
      eventId: searchParams.get("eventId") ?? undefined,
      assigneeId: searchParams.get("assigneeId") ?? undefined,
    })
  );
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const body = createSchema.parse(await request.json());
    const task = await tasks.create(session.id, body);
    return NextResponse.json(task, { status: 201 });
  });
}
