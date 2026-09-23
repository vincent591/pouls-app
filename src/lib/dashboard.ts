import type { Pillar } from "@prisma/client";
import { prisma } from "./prisma";
import { getIsoWeek, previousIsoWeek, lastNIsoWeeks, isoWeekLabel, type IsoWeek } from "./isoWeek";
import { PILLAR_ORDER, PILLARS, ALERT_TIPS, colorForScore, SCORE_LOW } from "./pillars";
import {
  scaleAverage,
  scaleAverageAcrossWeeks,
  choiceTopAnswer,
  recentComments,
  participation,
  computeAlertCandidates,
} from "./aggregate";
import { notifyManagerOfAlert } from "./notify";

export interface PillarCard {
  pillar: Pillar;
  label: string;
  color: string;
  value: string; // "3.4" or "–"
  pct: number; // 0-100
  delta: string | null; // "▲ 0.3" / "▼ 0.2" / null when not comparable
  deltaUp: boolean;
  sub: string;
}

export interface QuestionStat {
  questionId: string;
  pillarLabel: string;
  pillarColor: string;
  text: string;
  avgLabel: string; // "3.6" or "n/d"
  pct: number;
  barColor: string;
}

export interface ChoiceStat {
  questionId: string;
  text: string;
  top: string;
  share: string;
}

export interface TrendPoint {
  weekLabel: string;
  value: string;
  pct: number;
  color: string;
}

export interface AlertView {
  id: string;
  questionId: string;
  color: string;
  pillarLabel: string;
  title: string;
  body: string;
  tip: string;
  status: "open" | "planned" | "dismissed";
}

export interface DashboardData {
  teamId: string;
  teamName: string;
  weekLabel: string;
  pillarCards: PillarCard[];
  kpis: { participationPct: number; participationSub: string; vigilanceLabel: string; vigilanceSub: string };
  qStats: QuestionStat[];
  choiceStats: ChoiceStat[];
  trend: TrendPoint[];
  comments: { text: string; weekLabel: string }[];
  alerts: AlertView[];
}

export async function getDashboardData(teamId: string, trendPillar: Pillar | "all" = "all"): Promise<DashboardData> {
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: teamId },
    include: { manager: true },
  });
  const current = getIsoWeek();
  const previous = previousIsoWeek(current);

  const pillarCards: PillarCard[] = await Promise.all(
    PILLAR_ORDER.map(async (pillar) => {
      const [a, b, nq] = await Promise.all([
        scaleAverage(teamId, current, pillar),
        scaleAverage(teamId, previous, pillar),
        prisma.question.count({ where: { orgId: team.orgId, pillar, type: "scale", active: true } }),
      ]);
      const delta = a.avg !== null && b.avg !== null ? a.avg - b.avg : null;
      return {
        pillar,
        label: PILLARS[pillar].label,
        color: PILLARS[pillar].color,
        value: a.avg !== null ? a.avg.toFixed(1) : "–",
        pct: a.avg !== null ? (a.avg / 5) * 100 : 0,
        delta: delta === null ? null : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}`,
        deltaUp: delta !== null && delta >= 0,
        sub: `${nq} question${nq > 1 ? "s" : ""} notée${nq > 1 ? "s" : ""} · vs semaine dernière`,
      };
    })
  );

  const scaleQuestions = await prisma.question.findMany({
    where: { orgId: team.orgId, type: "scale", active: true },
    orderBy: { position: "asc" },
  });
  const qStats: QuestionStat[] = await Promise.all(
    scaleQuestions.map(async (q) => {
      const { avg } = await scaleAverageAcrossWeeks(teamId, q.id, [current, previous]);
      return {
        questionId: q.id,
        pillarLabel: PILLARS[q.pillar].label,
        pillarColor: PILLARS[q.pillar].color,
        text: `${q.category} — ${q.text}`,
        avgLabel: avg !== null ? avg.toFixed(1) : "n/d",
        pct: avg !== null ? (avg / 5) * 100 : 0,
        barColor: avg !== null ? colorForScore(avg) : "#efece5",
      };
    })
  );

  const choiceQuestions = await prisma.question.findMany({
    where: { orgId: team.orgId, type: "choice", active: true },
    orderBy: { position: "asc" },
  });
  const choiceStatsRaw = await Promise.all(
    choiceQuestions.map(async (q) => ({ q, ...(await choiceTopAnswer(teamId, q.id)) }))
  );
  const choiceStats: ChoiceStat[] = choiceStatsRaw
    .filter((c) => c.top !== null)
    .map((c) => ({
      questionId: c.q.id,
      text: c.q.text,
      top: c.top as string,
      share: `${c.share} % des réponses`,
    }));

  const weeks = lastNIsoWeeks(6);
  const trend: TrendPoint[] = await Promise.all(
    weeks.map(async (w) => {
      const { avg } = await scaleAverage(teamId, w, trendPillar === "all" ? undefined : trendPillar);
      const color = trendPillar === "all" ? (avg !== null ? colorForScore(avg) : "#efece5") : PILLARS[trendPillar].color;
      return {
        weekLabel: isoWeekLabel(w),
        value: avg !== null ? avg.toFixed(1) : "–",
        pct: avg !== null ? (avg / 5) * 100 : 0,
        color,
      };
    })
  );

  const textQuestions = await prisma.question.findMany({
    where: { orgId: team.orgId, type: "text", active: true },
  });
  const commentLists = await Promise.all(textQuestions.map((q) => recentComments(teamId, q.id, 4)));
  const comments = commentLists
    .flat()
    .slice(0, 4);

  const part = await participation(teamId, current);
  const scoredQStats = qStats.filter((s) => s.avgLabel !== "n/d");
  const weakest = scoredQStats.length
    ? scoredQStats.reduce((min, s) => (parseFloat(s.avgLabel) < parseFloat(min.avgLabel) ? s : min))
    : null;

  const alerts = await buildAlerts(teamId, team.name, team.manager?.email ?? null, current);

  return {
    teamId,
    teamName: team.name,
    weekLabel: isoWeekLabel(current),
    pillarCards,
    kpis: {
      participationPct: part.pct,
      participationSub: `${part.responseCount} réponses sur ${part.memberCount} personnes`,
      vigilanceLabel: weakest ? (weakest.text.split(" — ")[0] ?? weakest.text) : "—",
      vigilanceSub: weakest ? `Moyenne ${weakest.avgLabel} / 5` : "",
    },
    qStats,
    choiceStats,
    trend,
    comments,
    alerts,
  };
}

async function buildAlerts(
  teamId: string,
  teamName: string,
  managerEmail: string | null,
  current: IsoWeek
): Promise<AlertView[]> {
  const candidates = await computeAlertCandidates(teamId, current);
  const out: AlertView[] = [];

  for (const c of candidates) {
    const question = await prisma.question.findUniqueOrThrow({ where: { id: c.questionId } });
    const existing = await prisma.alert.findUnique({
      where: { teamId_questionId_isoWeek_year: { teamId, questionId: c.questionId, isoWeek: current.isoWeek, year: current.year } },
    });

    const title = `${question.category}${c.kind === "drop" ? " en baisse" : " à un niveau bas"}`;
    const body =
      c.kind === "drop" && c.previousAvg !== null
        ? `${c.previousAvg.toFixed(1)} → ${c.currentAvg.toFixed(1)} cette semaine.`
        : `Moyenne ${c.currentAvg.toFixed(1)} / 5.`;

    if (!existing) {
      const created = await prisma.alert.create({
        data: { teamId, questionId: c.questionId, isoWeek: current.isoWeek, year: current.year, kind: c.kind },
      });
      void notifyManagerOfAlert({ managerEmail, teamName, title, body: `${body} ${ALERT_TIPS[question.pillar]}` });
      out.push({
        id: created.id,
        questionId: c.questionId,
        color: c.kind === "low" ? SCORE_LOW : "oklch(0.66 0.13 55)",
        pillarLabel: PILLARS[question.pillar].label,
        title,
        body: `${body} ${ALERT_TIPS[question.pillar]}`,
        tip: ALERT_TIPS[question.pillar],
        status: "open",
      });
      continue;
    }

    if (existing.status === "dismissed") continue;

    out.push({
      id: existing.id,
      questionId: c.questionId,
      color: c.kind === "low" ? SCORE_LOW : "oklch(0.66 0.13 55)",
      pillarLabel: PILLARS[question.pillar].label,
      title,
      body: `${body} ${ALERT_TIPS[question.pillar]}`,
      tip: ALERT_TIPS[question.pillar],
      status: existing.status as "open" | "planned",
    });
  }

  return out;
}
