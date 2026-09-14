import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, isSessionError, withApiErrors } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { RSVP_STATUSES } from "@/lib/types";

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

    const guestEvent = await db.guestEvent.upsert({
      where: { guestId_eventId: { guestId: id, eventId } },
      update: { rsvp },
      create: { guestId: id, eventId, rsvp },
      include: { event: true, guest: true },
    });

    await recordActivity({
      userId: session.id,
      action: "UPDATED",
      entityType: "Guest",
      entityId: id,
      summary: `${session.name ?? "Someone"} set ${guestEvent.guest.firstName}'s RSVP for ${guestEvent.event.name} to ${rsvp}`,
    });

    return NextResponse.json(guestEvent);
  });
}
