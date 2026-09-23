import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/azure-ad";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { consumeLoginToken } from "./magicLink";

// Production auth is SSO-only (Microsoft Entra ID and/or Google Workspace) per
// README §"Rôles et contrôle d'accès": "pas de mots de passe gérés en interne".
// The Credentials provider below is a dev-only substitute for the demo
// accounts and MUST stay disabled unless ENABLE_DEMO_LOGIN=true — never set
// that in a deployed environment.
//
// The actual guard lives inside authorize() (below), evaluated per sign-in
// attempt, not at module load: `next build` sets NODE_ENV=production for the
// build step itself (even for a purely local build), and a top-level throw
// here would break that build. Blocking real demo sign-ins at request time,
// in an environment that's actually NODE_ENV=production, is what matters.
const demoLoginEnabled = process.env.ENABLE_DEMO_LOGIN === "true";
if (demoLoginEnabled && process.env.NODE_ENV === "production") {
  console.warn(
    "[auth] ENABLE_DEMO_LOGIN=true with NODE_ENV=production — demo sign-in attempts will be rejected at request time. Remove this env var for a real deployment."
  );
}

const providers: AuthOptions["providers"] = [];

if (demoLoginEnabled) {
  providers.push(
    CredentialsProvider({
      id: "demo",
      name: "Compte de démo",
      credentials: {
        email: { label: "E-mail professionnel", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (process.env.NODE_ENV === "production") {
          throw new Error("Demo login is disabled when NODE_ENV=production.");
        }
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });
        if (!user?.demoPasswordHash || !user.active) return null;
        const valid = await bcrypt.compare(credentials.password, user.demoPasswordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    })
  );
}

// Passwordless e-mail sign-in — the primary auth method for orgs without
// managed SSO (Entra ID / Google Workspace), e.g. employees with only
// personal e-mail addresses. See src/lib/magicLink.ts and
// src/app/api/auth/magic-link/route.ts (which issues the token) and
// src/app/login/verify/page.tsx (which calls signIn("magic", ...) with it).
providers.push(
  CredentialsProvider({
    id: "magic",
    name: "Lien de connexion",
    credentials: {
      email: { label: "E-mail", type: "email" },
      token: { label: "Jeton", type: "text" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials.token) return null;
      const email = credentials.email.trim().toLowerCase();
      const valid = await consumeLoginToken(email, credentials.token);
      if (!valid) return null;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.active) return null;
      return { id: user.id, email: user.email, name: user.name };
    },
  })
);

if (process.env.AZURE_AD_CLIENT_ID) {
  providers.push(
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
      tenantId: process.env.AZURE_AD_TENANT_ID,
    })
  );
}

if (process.env.GOOGLE_CLIENT_ID) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    })
  );
}

export const authOptions: AuthOptions = {
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      // Accounts are provisioned by HR (via the "Employés" admin screen or
      // User seeding), never self-service: SSO sign-in only succeeds for a
      // known, active e-mail.
      if (account?.provider === "demo") return true;
      if (!user.email) return false;
      const dbUser = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
      return !!dbUser?.active;
    },
    async jwt({ token }) {
      if (!token.email) return token;
      const dbUser = await prisma.user.findUnique({
        where: { email: token.email.toLowerCase() },
        select: { id: true, name: true, role: true, orgId: true, teamId: true, active: true },
      });
      if (dbUser?.active) {
        token.uid = dbUser.id;
        token.name = dbUser.name;
        token.role = dbUser.role;
        token.orgId = dbUser.orgId;
        token.teamId = dbUser.teamId;
      } else {
        // Deactivated (or deleted) since the token was issued: strip the
        // role so access.ts/middleware.ts treat this session as signed out,
        // instead of trusting a stale, now-revoked role from the JWT.
        delete token.uid;
        delete token.role;
        delete token.orgId;
        delete token.teamId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as "employee" | "manager" | "admin";
        session.user.orgId = token.orgId as string;
        session.user.teamId = (token.teamId as string | null) ?? null;
      }
      return session;
    },
  },
};
