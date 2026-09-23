import type { Pillar } from "@prisma/client";
import { prisma } from "./prisma";
import { ANONYMITY_THRESHOLD } from "./pillars";
import { type IsoWeek, previousIsoWeek } from "./isoWeek";

/**
 * All aggregation for the manager/admin dashboard funnels through this file
 * so the k=5 anonymity rule (README §"Rôles et contrôle d'accès", marked
 * CRITICAL) is enforced in exactly one place: `count < ANONYMITY_THRESHOLD`
 * always yields `null`/`"n/d"`, never a computed value.
 */

export interface ScopedAverage {
  avg: number | null; // null => below threshold ("n/d")
  count: number;
}

async function surveyId(teamId: string, week: IsoWeek): Promise<string | null> {
  const survey = await prisma.survey.findUnique({
    where: { teamId_isoWeek_year: { teamId, isoWeek: week.isoWeek, year: week.year } },
    select: { id: true },
  });
  return survey?.id ?? null;
}

export async function scaleAverage(
  teamId: string,
  week: IsoWeek,
  pillar?: Pillar
): Promise<ScopedAverage> {
  const sid = await surveyId(teamId, week);
  if (!sid) return { avg: null, count: 0 };
  const answers = await prisma.answer.findMany({
    where: {
      response: { surveyId: sid },
      valueNumber: { not: null },
      question: { type: "scale", ...(pillar ? { pillar } : {}) },
    },
    select: { valueNumber: true },
  });
  const count = answers.length;
  if (count < ANONYMITY_THRESHOLD) return { avg: null, count };
  const avg = answers.reduce((a, b) => a + (b.valueNumber ?? 0), 0) / count;
  return { avg, count };
}

/** Average across two consecutive weeks combined (mirrors the prototype's per-question stat, which pools "S39 ou S38"). */
export async function scaleAverageAcrossWeeks(
  teamId: string,
  questionId: string,
  weeks: IsoWeek[]
): Promise<ScopedAverage> {
  const sids = (
    await Promise.all(weeks.map((w) => surveyId(teamId, w)))
  ).filter((id): id is string => !!id);
  if (sids.length === 0) return { avg: null, count: 0 };
  const answers = await prisma.answer.findMany({
    where: { response: { surveyId: { in: sids } }, questionId, valueNumber: { not: null } },
    select: { valueNumber: true },
  });
  const count = answers.length;
  if (count < ANONYMITY_THRESHOLD) return { avg: null, count };
  const avg = answers.reduce((a, b) => a + (b.valueNumber ?? 0), 0) / count;
  return { avg, count };
}

export async function choiceTopAnswer(
  teamId: string,
  questionId: string
): Promise<{ top: string | null; share: number | null; count: number }> {
  const answers = await prisma.answer.findMany({
    where: { response: { teamId }, questionId, valueText: { not: null } },
    select: { valueText: true },
  });
  const count = answers.length;
  if (count < ANONYMITY_THRESHOLD) return { top: null, share: null, count };
  const tally = new Map<string, number>();
  for (const a of answers) {
    if (!a.valueText) continue;
    tally.set(a.valueText, (tally.get(a.valueText) ?? 0) + 1);
  }
  let top: string | null = null;
  let topCount = 0;
  for (const [value, n] of tally) {
    if (n > topCount) {
      top = value;
      topCount = n;
    }
  }
  return { top, share: top ? Math.round((topCount / count) * 100) : null, count };
}

export async function recentComments(teamId: string, questionId: string, limit = 4) {
  const answers = await prisma.answer.findMany({
    where: {
      questionId,
      valueText: { not: null },
      response: { teamId },
    },
    include: { response: { include: { survey: true } } },
    orderBy: { response: { createdAt: "desc" } },
    take: limit * 4, // over-fetch, then drop weeks below the anonymity threshold
  });
  const out: { text: string; weekLabel: string }[] = [];
  for (const a of answers) {
    if (out.length >= limit) break;
    if (!a.valueText?.trim()) continue;
    const week = { isoWeek: a.response.survey.isoWeek, year: a.response.survey.year };
    const total = await prisma.response.count({ where: { surveyId: a.response.surveyId } });
    if (total < ANONYMITY_THRESHOLD) continue;
    out.push({ text: a.valueText, weekLabel: `S${String(week.isoWeek).padStart(2, "0")}` });
  }
  return out;
}

export async function participation(teamId: string, week: IsoWeek) {
  const [team, sid] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      select: { _count: { select: { members: { where: { active: true } } } } },
    }),
    surveyId(teamId, week),
  ]);
  const memberCount = team?._count.members ?? 0;
  const responseCount = sid ? await prisma.response.count({ where: { surveyId: sid } }) : 0;
  return { memberCount, responseCount, pct: memberCount ? Math.min(100, Math.round((responseCount / memberCount) * 100)) : 0 };
}

export interface AlertCandidate {
  questionId: string;
  kind: "drop" | "low";
  currentAvg: number;
  previousAvg: number | null;
}

/** Applies the README rule: drop ≥0.4pt vs previous week, OR average below 2.6 — both computed only on ≥k averages. */
export async function computeAlertCandidates(teamId: string, week: IsoWeek): Promise<AlertCandidate[]> {
  const prev = previousIsoWeek(week);
  const questions = await prisma.question.findMany({
    where: { active: true, type: "scale" },
  });
  const out: AlertCandidate[] = [];
  for (const q of questions) {
    const cur = await scaleAverageAcrossWeeks(teamId, q.id, [week]);
    if (cur.avg === null) continue; // below anonymity threshold, or no data
    const prevAvg = await scaleAverageAcrossWeeks(teamId, q.id, [prev]);
    const drop = prevAvg.avg !== null && cur.avg - prevAvg.avg <= -0.4;
    const low = cur.avg < 2.6;
    if (drop) out.push({ questionId: q.id, kind: "drop", currentAvg: cur.avg, previousAvg: prevAvg.avg });
    else if (low) out.push({ questionId: q.id, kind: "low", currentAvg: cur.avg, previousAvg: prevAvg.avg });
  }
  return out;
}
