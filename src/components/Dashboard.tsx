"use client";

import { useEffect, useState, useTransition } from "react";
import type { Pillar } from "@prisma/client";
import type { DashboardData } from "@/lib/dashboard";

const TREND_TABS: { key: Pillar | "all"; label: string }[] = [
  { key: "all", label: "Global" },
  { key: "bienetre", label: "Bien-être" },
  { key: "engagement", label: "Engagement" },
  { key: "performance", label: "Performance" },
];

export default function Dashboard({
  initialData,
  isAdmin,
  teams,
}: {
  initialData: DashboardData;
  isAdmin: boolean;
  teams: { id: string; name: string }[];
}) {
  const [data, setData] = useState(initialData);
  const [teamId, setTeamId] = useState(initialData.teamId);
  const [trendPillar, setTrendPillar] = useState<Pillar | "all">("all");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const params = new URLSearchParams({ teamId, trendPillar });
    startTransition(() => {
      fetch(`/api/dashboard?${params}`)
        .then((r) => r.json())
        .then(setData);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, trendPillar]);

  async function act(alertId: string, action: "plan" | "dismiss") {
    setData((d) => ({
      ...d,
      alerts:
        action === "dismiss"
          ? d.alerts.filter((a) => a.id !== alertId)
          : d.alerts.map((a) => (a.id === alertId ? { ...a, status: "planned" } : a)),
    }));
    await fetch("/api/dashboard/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, alertId, action }),
    });
  }

  return (
    <div className="flex flex-col gap-6" style={{ opacity: isPending ? 0.7 : 1 }}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 font-display text-[32px] tracking-[-0.02em]">{data.teamName}</h1>
          <div className="mt-1 text-[15px] text-muted">
            Réponses agrégées et anonymisées · minimum 5 réponses par indicateur
          </div>
        </div>
        {isAdmin && (
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="rounded-md border border-border bg-field px-3 py-2 text-sm"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <section className="flex flex-col gap-[10px]">
        <div className="font-display text-lg font-bold">
          Alertes <span className="font-body text-sm font-medium text-muted">· baisse ≥ 0,4 pt ou moyenne sous 2,6</span>
        </div>
        {data.alerts.length === 0 && (
          <div className="rounded-lg border border-dashed border-dottedLine px-[18px] py-[14px] text-sm text-muted">
            Aucune alerte cette semaine.
          </div>
        )}
        {data.alerts.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4"
          >
            <div className="h-3 w-3 flex-none rounded-full" style={{ background: a.color }} />
            <div className="flex min-w-[220px] flex-1 flex-col gap-[3px]">
              <div className="text-[15px] font-semibold">
                {a.title} <span className="font-normal text-muted">· {a.pillarLabel}</span>
              </div>
              <div className="text-sm leading-[1.45] text-muted">{a.body}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => act(a.id, "plan")}
                disabled={a.status === "planned"}
                className="cursor-pointer rounded-md border-0 px-[14px] py-[9px] text-[13px] font-semibold"
                style={{
                  background: a.status === "planned" ? "oklch(0.92 0.05 155)" : "#22201c",
                  color: a.status === "planned" ? "oklch(0.38 0.08 155)" : "#fffdf9",
                }}
              >
                {a.status === "planned" ? "Point planifié ✓" : "Planifier un point"}
              </button>
              <button
                onClick={() => act(a.id, "dismiss")}
                className="cursor-pointer rounded-md border border-border bg-transparent px-3 py-[9px] text-[13px] font-semibold text-muted"
              >
                Ignorer
              </button>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {data.pillarCards.map((p) => (
          <div
            key={p.pillar}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5"
            style={{ borderTop: `4px solid ${p.color}` }}
          >
            <div className="text-sm font-semibold">{p.label}</div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[40px] font-bold tracking-[-0.02em]">{p.value}</span>
              <span className="text-sm text-muted">/ 5</span>
              {p.delta && (
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: p.deltaUp ? "oklch(0.5 0.1 155)" : "oklch(0.6 0.14 30)" }}
                >
                  {p.delta}
                </span>
              )}
            </div>
            <div className="h-[6px] overflow-hidden rounded-md bg-subtle">
              <div className="h-full" style={{ width: `${p.pct}%`, background: p.color }} />
            </div>
            <div className="text-[13px] text-muted">{p.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="flex flex-col gap-[6px] rounded-xl border border-border bg-surface p-5">
          <div className="text-[13px] text-muted">Participation</div>
          <div className="font-display text-[34px] font-bold tracking-[-0.02em]">{data.kpis.participationPct} %</div>
          <div className="text-[13px] text-muted">{data.kpis.participationSub}</div>
        </div>
        <div className="flex flex-col gap-[6px] rounded-xl border border-border bg-surface p-5">
          <div className="text-[13px] text-muted">Point de vigilance</div>
          <div className="font-display text-[34px] font-bold tracking-[-0.02em] text-score-low">
            {data.kpis.vigilanceLabel}
          </div>
          <div className="text-[13px] text-muted">{data.kpis.vigilanceSub}</div>
        </div>
      </div>

      <div className="grid items-start gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
        <section className="flex flex-col gap-[18px] rounded-xl border border-border bg-surface p-6">
          <div className="font-display text-lg font-bold">Par question · moyenne /5</div>
          {data.qStats.map((q) => (
            <div key={q.questionId} className="flex flex-col gap-[7px]">
              <div className="flex justify-between gap-3 text-sm">
                <span>
                  <span
                    className="mr-[6px] rounded-pill px-[7px] py-[2px] text-[11px] font-semibold text-surface"
                    style={{ background: q.pillarColor }}
                  >
                    {q.pillarLabel}
                  </span>
                  {q.text}
                </span>
                <span className="font-semibold">{q.avgLabel}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-md bg-subtle">
                <div className="h-full rounded-md" style={{ width: `${q.pct}%`, background: q.barColor }} />
              </div>
            </div>
          ))}
          {data.choiceStats.map((c) => (
            <div key={c.questionId} className="rounded-md bg-page px-4 py-[14px] text-sm leading-[1.5]">
              <span className="text-muted">{c.text}</span>
              <br />
              <strong>{c.top}</strong> · {c.share}
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-[18px] rounded-xl border border-border bg-surface p-6">
          <div className="font-display text-lg font-bold">Tendance sur 6 semaines</div>
          <div className="flex flex-wrap gap-1 rounded-md bg-subtle p-1">
            {TREND_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTrendPillar(t.key)}
                className="flex-1 rounded-sm px-[10px] py-[7px] text-[13px] font-semibold"
                style={{
                  background: trendPillar === t.key ? "#fffdf9" : "transparent",
                  color: trendPillar === t.key ? "#22201c" : "#6b665d",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid h-[160px] grid-cols-6 items-end gap-[10px]">
            {data.trend.map((t) => (
              <div key={t.weekLabel} className="flex h-full flex-col items-center justify-end gap-2">
                <div className="text-[13px] font-semibold">{t.value}</div>
                <div className="w-full rounded-[6px_6px_2px_2px]" style={{ height: `${t.pct}%`, background: t.color }} />
                <div className="text-xs text-muted">{t.weekLabel}</div>
              </div>
            ))}
          </div>
          <div className="mt-[6px] font-display text-base font-bold">Mots partagés récemment</div>
          <div className="flex flex-col gap-2">
            {data.comments.length === 0 && (
              <div className="text-sm text-muted">Rien à afficher pour l&apos;instant.</div>
            )}
            {data.comments.map((c, i) => (
              <div key={i} className="rounded-md border border-border px-[14px] py-3 text-sm leading-[1.5]">
                « {c.text} » <span className="text-xs text-muted">· {c.weekLabel}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
