import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse, ApiError, getSession } from "@/lib/access";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getSession();
  if (!session || !session.user.role) throw new ApiError(401, "Non authentifié.");
  if (session.user.role !== "admin") throw new ApiError(403, "Accès refusé.");
  return session;
}

// Team selector for the admin "Toutes les équipes" view — README §4.
export async function GET() {
  try {
    const session = await requireAdmin();
    const teams = await prisma.team.findMany({
      where: { orgId: session.user.orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ teams });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

// Used from the "Employés" admin screen's "+ Nouvelle équipe" option.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = (await req.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "Nom d'équipe requis." }, { status: 400 });

    const team = await prisma.team.create({ data: { orgId: session.user.orgId, name } });
    return NextResponse.json({ team });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
