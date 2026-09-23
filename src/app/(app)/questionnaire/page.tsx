import { requireSpace } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import QuestionnaireEditor from "@/components/QuestionnaireEditor";
import type { FollowUp } from "@/lib/followUp";

export default async function QuestionnairePage() {
  const session = await requireSpace("questionnaire");
  const questions = await prisma.question.findMany({
    where: { orgId: session.user.orgId, archivedAt: null },
    orderBy: { position: "asc" },
  });

  const dto = questions.map((q) => ({
    ...q,
    followUp: (q.followUp as unknown as FollowUp | null) ?? null,
  }));

  return <QuestionnaireEditor initialQuestions={dto} />;
}
