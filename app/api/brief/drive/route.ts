import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isSessionError, withApiErrors, apiError } from "@/lib/http";
import * as brief from "@/lib/services/brief";
import * as drive from "@/lib/services/drive";

export const dynamic = "force-dynamic";

const schema = z.object({ enabled: z.boolean() });

/** GET /api/brief/drive — is Drive sync on, and has this user consented? */
export async function GET() {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return NextResponse.json(await drive.state());
}

/**
 * POST /api/brief/drive — turns sync on for the signed-in user (they must
 * already have re-consented to drive.file through Auth.js) or off again.
 * Behind FEATURE_DRIVE_BRIEF; failures never block Brief generation.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (isSessionError(session)) return session;

  return withApiErrors(async () => {
    if (!drive.isEnabled()) {
      return apiError("Drive sync is switched off on this server (FEATURE_DRIVE_BRIEF)", 503);
    }

    const { enabled } = schema.parse(await request.json());
    if (!enabled) return NextResponse.json(await drive.disable());

    const state = await drive.enableFor(session.id);
    if (!state.hasScope) {
      return apiError(
        "Google Drive access has not been granted yet. Sign in again and approve Drive access.",
        403
      );
    }

    const latest = await brief.latest();
    if (latest) await drive.syncBriefToDrive(latest.markdown);

    return NextResponse.json(await drive.state());
  });
}
