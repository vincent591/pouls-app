import type { Pillar, Question } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./access";
import { getIsoWeek, lastNIsoWeeks, isoWeekLabel, type IsoWeek } from "./isoWeek";
import { PILLAR_ORDER } from "./pillars";

export async function getActiveQuestions(orgId: string): Promise<Question[]> {
  return prisma.question.findMany({
    where: { orgId, active: true },
    orderBy: { position: "asc" },
  });
}

export async function hasSubmittedThisWeek(userId: string, week: IsoWeek): Promise<boolean> {
  const receipt = await prisma.checkinReceipt.findUnique({
    where: { userId_isoWeek_year: { userId, isoWeek: week.isoWeek, year: week.year } },
  });
  return !!receipt;
}

export interface SubmittedAnswer {
  questionId: string;
  isFollowUp: boolean;
  value: number | string;
}

export interface SubmitCheckinInput {
  userId: string;
  orgId: string;
  teamId: string | null;
  anonymous: boolean;
  answers: SubmittedAnswer[];
}

/**
 * Persists a check-in. Writes go to three places on purpose:
 *  - Response/Answer: the content, with userId=NULL when anonymous (no
 *    reversible link — README §"Rôles et contrôle d'accès").
 *  - CheckinReceipt: enforces "one check-in per person per week" without
 *    ever being joined to Answer content.
 *  - PersonalHistoryEntry: a per-pillar score only, so the employee's own
 *    "Ton évolution" chart works even when they answered anonymously.
 */
export async function submitCheckin(input: SubmitCheckinInput, week: IsoWeek = getIsoWeek()) {
  if (!input.teamId) throw new ApiError(400, "Aucune équipe associée à ce compte.");

  if (await hasSubmittedThisWeek(input.userId, week)) {
    throw new ApiError(409, "Tu as déjà répondu au check-in de cette semaine.");
  }

  const questions = await getActiveQuestions(input.orgId);
  const byId = new Map(questions.map((q) => [q.id, q]));

  const survey = await prisma.survey.upsert({
    where: { teamId_isoWeek_year: { teamId: input.teamId, isoWeek: week.isoWeek, year: week.year } },
    create: { teamId: input.teamId, isoWeek: week.isoWeek, year: week.year },
    update: {},
  });

  await prisma.$transaction(async (tx) => {
    const response = await tx.response.create({
      data: {
        surveyId: survey.id,
        teamId: input.teamId!,
        userId: input.anonymous ? null : input.userId,
        anonymous: input.anonymous,
      },
    });

    for (const a of input.answers) {
      const question = byId.get(a.questionId);
      const isScale = !a.isFollowUp && question?.type === "scale";
      await tx.answer.create({
        data: {
          responseId: response.id,
          questionId: a.questionId,
          isFollowUp: a.isFollowUp,
          valueNumber: isScale && typeof a.value === "number" ? a.value : null,
          valueText: !isScale ? String(a.value) : null,
        },
      });
    }

    await tx.checkinReceipt.create({
      data: { userId: input.userId, teamId: input.teamId!, isoWeek: week.isoWeek, year: week.year },
    });

    const byPillar = new Map<Pillar, number[]>();
    for (const a of input.answers) {
      if (a.isFollowUp || typeof a.value !== "number") continue;
      const question = byId.get(a.questionId);
      if (!question || question.type !== "scale") continue;
      const list = byPillar.get(question.pillar) ?? [];
      list.push(a.value);
      byPillar.set(question.pillar, list);
    }
    for (const [pillar, values] of byPillar) {
      const score = values.reduce((s, v) => s + v, 0) / values.length;
      await tx.personalHistoryEntry.upsert({
        where: { userId_isoWeek_year_pillar: { userId: input.userId, isoWeek: week.isoWeek, year: week.year, pillar } },
        create: { userId: input.userId, isoWeek: week.isoWeek, year: week.year, pillar, score },
        update: { score },
      });
    }
  });
}

export interface PersonalHistoryPoint {
  weekLabel: string;
  value: number | null;
}

export interface PersonalHistoryForPillar {
  pillar: Pillar;
  points: PersonalHistoryPoint[];
  insight: string;
}

const INSIGHT: Record<Pillar, { up: string; down: string }> = {
  bienetre: {
    up: "Ton bien-être progresse. Continue de t'accorder des pauses.",
    down: "Ton bien-être a baissé récemment. Tu peux en parler à ton manager ou consulter les ressources RH.",
  },
  engagement: {
    up: "Ton engagement est en hausse sur la période.",
    down: "Ton engagement baisse : un point avec ton manager sur tes missions peut aider.",
  },
  performance: {
    up: "Tu avances bien sur tes priorités.",
    down: "Tu avances moins sur tes priorités. Identifie ce qui te freine au prochain check-in.",
  },
};

export async function getPersonalHistory(userId: string): Promise<PersonalHistoryForPillar[]> {
  const weeks = lastNIsoWeeks(6);
  const entries = await prisma.personalHistoryEntry.findMany({
    where: {
      userId,
      OR: weeks.map((w) => ({ isoWeek: w.isoWeek, year: w.year })),
    },
  });

  return PILLAR_ORDER.map((pillar) => {
    const points = weeks.map((w) => {
      const entry = entries.find((e) => e.pillar === pillar && e.isoWeek === w.isoWeek && e.year === w.year);
      return { weekLabel: isoWeekLabel(w), value: entry ? entry.score : null };
    });
    const known = points.map((p) => p.value).filter((v): v is number => v !== null);
    const up = known.length >= 2 && known[known.length - 1]! >= known[0]!;
    const insight = known.length ? (up ? INSIGHT[pillar].up : INSIGHT[pillar].down) : "";
    return { pillar, points, insight };
  });
}
