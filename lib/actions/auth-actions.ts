"use server";

import { signIn, signOut } from "@/auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function signInGoogleAction() {
  await signIn("google", { redirectTo: "/" });
}
