import { NextResponse, type NextRequest } from "next/server";
import type { Pillar } from "@prisma/client";
import { apiErrorResponse, requireApiSpace, resolveDashboardTeamId } from "@/lib/access";
import { getDashboardData } from "@/lib/dashboard";

const VALID_PILLARS: (Pillar | "all")[] = ["all", "bienetre", "engagement", "performance"];

export async function GET(req: NextRequest) {
  try {
    const session = await requireApiSpace("equipe");
    const requestedTeamId = req.nextUrl.searchParams.get("teamId");
    const trendPillarParam = req.nextUrl.searchParams.get("trendPillar") ?? "all";
    const trendPillar = VALID_PILLARS.includes(trendPillarParam as Pillar | "all")
      ? (trendPillarParam as Pillar | "all")
      : "all";

    const teamId = await resolveDashboardTeamId(session, requestedTeamId);
    const data = await getDashboardData(teamId, trendPillar);
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
