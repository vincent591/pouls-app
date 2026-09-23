import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse, requireApiSpace, resolveDashboardTeamId, ApiError } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiSpace("equipe");
    const body = (await req.json()) as { teamId: string; alertId: string; action: "plan" | "dismiss" };
    // Throws if this session isn't allowed to see that team's dashboard.
    const teamId = await resolveDashboardTeamId(session, body.teamId);

    const alert = await prisma.alert.findUnique({ where: { id: body.alertId } });
    if (!alert || alert.teamId !== teamId) throw new ApiError(404, "Alerte introuvable.");

    const status = body.action === "plan" ? "planned" : "dismissed";
    // "Planifier un point" (README): idéalement, crée aussi un événement
    // d'agenda pour le manager — non implémenté ici (pas d'intégration
    // calendrier configurée), seul le statut est persisté.
    await prisma.alert.update({ where: { id: alert.id }, data: { status } });

    return NextResponse.json({ ok: true, status });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
