import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { RSVP_STATUSES } from "@/lib/types";
import * as guests from "@/lib/services/guests";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  eventId: z.string().min(1),
  rsvp: z.enum(RSVP_STATUSES),
});

// Upserts the guest's RSVP for one event (DESIGN.md §6: "guests/[id]/events PATCH rsvp").
export async function PATCH(request: Request, ctx: RouteContext<"/api/guests/[id]/events">) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    const { id } = await ctx.params;
    const { eventId, rsvp } = patchSchema.parse(await request.json());
    const guestEvent = await guests.setRsvp(session.id, id, eventId, rsvp);
    return NextResponse.json(guestEvent);
  });
}
