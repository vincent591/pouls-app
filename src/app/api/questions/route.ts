import { NextResponse, type NextRequest } from "next/server";
import type { Pillar, QuestionType } from "@prisma/client";
import { apiErrorResponse, requireApiSpace } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireApiSpace("questionnaire");
    const questions = await prisma.question.findMany({
      where: { orgId: session.user.orgId, archivedAt: null },
      orderBy: { position: "asc" },
    });
    return NextResponse.json({ questions });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

interface CreateBody {
  pillar: Pillar;
  type: QuestionType;
  text: string;
  category: string;
  lowLabel?: string;
  highLabel?: string;
  options?: string[];
  followUpText?: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiSpace("questionnaire");
    const body = (await req.json()) as CreateBody;

    const text = body.text?.trim();
    if (!text) return NextResponse.json({ error: "La question est requise." }, { status: 400 });
    if (body.type === "choice" && (!body.options || body.options.filter((o) => o.trim()).length < 2)) {
      return NextResponse.json({ error: "Au moins deux réponses sont requises." }, { status: 400 });
    }

    const max = await prisma.question.aggregate({
      where: { orgId: session.user.orgId },
      _max: { position: true },
    });

    const question = await prisma.question.create({
      data: {
        orgId: session.user.orgId,
        pillar: body.pillar,
        type: body.type,
        text,
        category: body.category?.trim() || "Général",
        active: true,
        position: (max._max.position ?? 0) + 1,
        ...(body.type === "scale"
          ? {
              lowLabel: body.lowLabel?.trim() || "Pas du tout",
              highLabel: body.highLabel?.trim() || "Tout à fait",
              followUp: body.followUpText?.trim()
                ? { type: "text", text: body.followUpText.trim() }
                : undefined,
            }
          : {}),
        ...(body.type === "choice" ? { options: body.options!.map((o) => o.trim()).filter(Boolean) } : {}),
      },
    });

    return NextResponse.json({ question });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
