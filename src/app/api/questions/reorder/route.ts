import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse, requireApiSpace, ApiError } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiSpace("questionnaire");
    const body = (await req.json()) as { id: string; direction: "up" | "down" };

    const all = await prisma.question.findMany({
      where: { orgId: session.user.orgId, archivedAt: null },
      orderBy: { position: "asc" },
    });
    const i = all.findIndex((q) => q.id === body.id);
    if (i === -1) throw new ApiError(404, "Question introuvable.");
    const j = body.direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= all.length) return NextResponse.json({ ok: true }); // no-op at the edges

    const a = all[i]!;
    const b = all[j]!;
    await prisma.$transaction([
      prisma.question.update({ where: { id: a.id }, data: { position: b.position } }),
      prisma.question.update({ where: { id: b.id }, data: { position: a.position } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
