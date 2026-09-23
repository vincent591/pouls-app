import { getServerSession, type Session } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { SPACE_ACCESS, SPACE_LABEL, defaultSpaceFor, canAccessSpace, type Space } from "./spaces";

// Route/session guards (this file is Node-only — see spaces.ts for the
// Edge-safe constants middleware.ts needs).
export { SPACE_ACCESS, SPACE_LABEL, defaultSpaceFor, canAccessSpace, type Space };

/** Server Component / Route Handler session lookup. */
export async function getSession(): Promise<Session | null> {
  return getServerSession(authOptions);
}

/** Server Component guard: redirects to /login or to the user's default space. */
export async function requireSpace(space: Space): Promise<Session> {
  const session = await getSession();
  // A missing role means the account was deactivated after the session's
  // JWT was issued (see the jwt() callback in auth.ts) — treat it the same
  // as no session.
  if (!session || !session.user.role) redirect("/login");
  if (!canAccessSpace(session.user.role, space)) {
    redirect(`/${defaultSpaceFor(session.user.role)}`);
  }
  return session;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Route Handler guard: throws an ApiError (catch it and return NextResponse.json). */
export async function requireApiSpace(space: Space): Promise<Session> {
  const session = await getSession();
  if (!session || !session.user.role) throw new ApiError(401, "Non authentifié.");
  if (!canAccessSpace(session.user.role, space)) throw new ApiError(403, "Accès refusé.");
  return session;
}

export function apiErrorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
}

/**
 * Resolves which team a manager/admin session may view a dashboard for.
 * Manager: only their own managed team. Admin: any team in the org, chosen
 * via `requestedTeamId` (falls back to the org's first team).
 */
export async function resolveDashboardTeamId(
  session: Session,
  requestedTeamId?: string | null
): Promise<string> {
  if (session.user.role === "manager") {
    const team = await prisma.team.findUnique({ where: { managerId: session.user.id } });
    if (!team) throw new ApiError(404, "Aucune équipe gérée pour ce compte.");
    return team.id;
  }
  if (session.user.role === "admin") {
    if (requestedTeamId) {
      const team = await prisma.team.findFirst({
        where: { id: requestedTeamId, orgId: session.user.orgId },
      });
      if (!team) throw new ApiError(404, "Équipe introuvable.");
      return team.id;
    }
    const first = await prisma.team.findFirst({
      where: { orgId: session.user.orgId },
      orderBy: { name: "asc" },
    });
    if (!first) throw new ApiError(404, "Aucune équipe dans cette organisation.");
    return first.id;
  }
  throw new ApiError(403, "Accès refusé.");
}
