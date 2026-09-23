import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse, requireApiSpace, ApiError } from "@/lib/access";
import { prisma } from "@/lib/prisma";

async function loadOwned(id: string, orgId: string) {
  const question = await prisma.question.findFirst({ where: { id, orgId } });
  if (!question) throw new ApiError(404, "Question introuvable.");
  return question;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireApiSpace("questionnaire");
    const question = await loadOwned(params.id, session.user.orgId);
    const body = (await req.json()) as { active?: boolean };

    const updated = await prisma.question.update({
      where: { id: question.id },
      data: { ...(typeof body.active === "boolean" ? { active: body.active } : {}) },
    });
    return NextResponse.json({ question: updated });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireApiSpace("questionnaire");
    const question = await loadOwned(params.id, session.user.orgId);

    // Versioning is out of scope for this MVP (README flags it for later:
    // "versionner le questionnaire... préférer l'archivage à la suppression
    // dure"). We approximate it here: archive if any answers/alerts already
    // reference this question (keeps history intact), otherwise hard-delete.
    const [answerCount, alertCount] = await Promise.all([
      prisma.answer.count({ where: { questionId: question.id } }),
      prisma.alert.count({ where: { questionId: question.id } }),
    ]);

    if (answerCount > 0 || alertCount > 0) {
      await prisma.question.update({
        where: { id: question.id },
        data: { active: false, archivedAt: new Date() },
      });
    } else {
      await prisma.question.delete({ where: { id: question.id } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
