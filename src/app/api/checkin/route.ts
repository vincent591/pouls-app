import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse, requireApiSpace } from "@/lib/access";
import { getActiveQuestions, hasSubmittedThisWeek, submitCheckin, type SubmittedAnswer } from "@/lib/checkin";
import { getIsoWeek, isoWeekLabel } from "@/lib/isoWeek";

export async function GET() {
  try {
    const session = await requireApiSpace("employe");
    const week = getIsoWeek();
    const [questions, alreadySubmitted] = await Promise.all([
      getActiveQuestions(session.user.orgId),
      hasSubmittedThisWeek(session.user.id, week),
    ]);
    return NextResponse.json({
      firstName: session.user.name?.split(" ")[0] ?? "",
      weekLabel: isoWeekLabel(week),
      alreadySubmitted,
      questions,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiSpace("employe");
    const body = (await req.json()) as { anonymous: boolean; answers: SubmittedAnswer[] };
    if (!Array.isArray(body.answers)) {
      return NextResponse.json({ error: "Réponses invalides." }, { status: 400 });
    }
    await submitCheckin({
      userId: session.user.id,
      orgId: session.user.orgId,
      teamId: session.user.teamId,
      anonymous: !!body.anonymous,
      answers: body.answers,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
