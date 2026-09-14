import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, isSessionError, apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

// Sending a message and driving the tool loop is Phase B (PROMPTS.md §4).
// Phase A only exposes reading a thread's messages.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/chat/threads/[id]/messages">
) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  const { id } = await ctx.params;
  const thread = await db.chatThread.findUnique({ where: { id } });
  if (!thread) return apiError("Thread not found", 404);

  const messages = await db.chatMessage.findMany({
    where: { threadId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(messages);
}
