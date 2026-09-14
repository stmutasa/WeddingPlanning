import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same behaviour, new file
// name/export) — see node_modules/next/dist/docs/.../file-conventions/proxy.md.
// This stays edge/proxy-safe: it only imports `authConfig` (no Prisma
// adapter, no provider secrets), matching the auth.config.ts / auth.ts split
// DESIGN.md §9 asks for.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-touch-icon.png|icons/|manifest.webmanifest|sw.js).*)",
  ],
};
