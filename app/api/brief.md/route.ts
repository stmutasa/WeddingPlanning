import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// DESIGN.md §8: signed in, OR ?token= matching AppSettings.briefToken — this
// is the URL an external AI chat can be pointed at directly.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const settings = await db.appSettings.findUnique({ where: { id: "main" } });
    if (!settings?.briefToken || settings.briefToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
  }

  const latest = await db.briefSnapshot.findFirst({ orderBy: { generatedAt: "desc" } });
  if (!latest) {
    return NextResponse.json({ error: "No brief has been generated yet" }, { status: 404 });
  }

  return new NextResponse(latest.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
