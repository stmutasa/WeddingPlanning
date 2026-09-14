import { NextResponse } from "next/server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export const dynamic = "force-dynamic";

// Dev-only convenience sign-in. Never available in production, and only
// works for an email that is both DEV_LOGIN_EMAIL and in ALLOWED_EMAILS.
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }
  const email = process.env.DEV_LOGIN_EMAIL;
  if (!email) {
    return NextResponse.json({ error: "DEV_LOGIN_EMAIL is not set" }, { status: 400 });
  }
  try {
    await signIn("dev-login", { email, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Sign-in failed" }, { status: 401 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
