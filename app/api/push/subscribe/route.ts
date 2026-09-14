import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import * as push from "@/lib/services/push";

export const dynamic = "force-dynamic";

const schema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    if (!push.isConfigured()) {
      return apiError("Web push is not configured on this server (VAPID keys are unset)", 503);
    }
    const body = schema.parse(await request.json());
    const subscription = await push.subscribe(
      session.id,
      body,
      request.headers.get("user-agent")
    );
    return NextResponse.json({ ok: true, id: subscription.id }, { status: 201 });
  });
}
