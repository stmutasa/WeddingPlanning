import type { NextAuthConfig } from "next-auth";

// Edge/proxy-safe config: no providers, no adapter, no Prisma import here.
// `auth.ts` extends this with the Google provider and the PrismaAdapter,
// which need the Node.js runtime and the database.

const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/health",
  "/api/brief.md",
  "/api/plaid/webhook",
  "/api/dev-login",
  "/manifest.webmanifest",
  "/sw.js",
  "/icons",
  "/offline",
  "/favicon.ico",
  "/apple-touch-icon.png",
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}.`)
  );
}

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      if (isPublicPath(nextUrl.pathname)) return true;
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
