import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { authConfig } from "./auth.config";
import type { Hue } from "@/lib/types";

// DESIGN.md §9: on first sign-in, create UserSettings + Funder(kind USER)
// using this email -> displayName/hue map.
const EMAIL_PROFILE: Record<string, { displayName: string; hue: Hue }> = {
  "annettemugambi@gmail.com": { displayName: "Annette", hue: "pink" },
  "stmutasa@gmail.com": { displayName: "Simi", hue: "blue" },
};

function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function ensureUserBootstrap(userId: string, email: string) {
  const profile = EMAIL_PROFILE[email.toLowerCase()];
  const existing = await db.userSettings.findUnique({ where: { userId } });
  if (!existing) {
    await db.userSettings.create({
      data: {
        userId,
        displayName: profile?.displayName ?? null,
        hue: profile?.hue ?? "pink",
      },
    });
  }
  const existingFunder = await db.funder.findUnique({ where: { userId } });
  if (!existingFunder) {
    await db.funder.create({
      data: {
        userId,
        name: profile?.displayName ?? email,
        kind: "USER",
      },
    });
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: { params: { scope: "openid email profile" } },
    }),
    // Dev-only: lets `POST /api/dev-login` sign in as DEV_LOGIN_EMAIL
    // without Google OAuth. Never present in production.
    ...(process.env.NODE_ENV !== "production"
      ? [
          Credentials({
            id: "dev-login",
            name: "Dev sign-in",
            credentials: { email: { label: "Email", type: "email" } },
            async authorize(credentials) {
              const email =
                typeof credentials?.email === "string"
                  ? credentials.email.toLowerCase()
                  : null;
              if (!email || !allowedEmails().includes(email)) return null;
              const user = await db.user.findUnique({ where: { email } });
              if (!user) return null;
              return { id: user.id, email: user.email, name: user.name };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      if (!allowedEmails().includes(email)) return false;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id;
        await ensureUserBootstrap(user.id, user.email ?? "");
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.uid === "string") {
        session.user.id = token.uid;
      }
      return session;
    },
  },
});
