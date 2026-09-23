"use client";

import { useState } from "react";
import type { Pillar } from "@prisma/client";
import { PILLARS, PILLAR_ORDER } from "@/lib/pillars";

interface PersonalHistoryForPillar {
  pillar: Pillar;
  points: { weekLabel: string; value: number | null }[];
  insight: string;
}

export default function HistoryCard({ history }: { history: PersonalHistoryForPillar[] }) {
  const [active, setActive] = useState<Pillar>("bienetre");
  const current = history.find((h) => h.pillar === active) ?? history[0];

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-7">
      <div>
        <div className="font-display text-xl font-bold">Ton évolution</div>
        <div className="mt-1 text-sm text-muted">Visible par toi seul·e · 6 dernières semaines</div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-md bg-subtle p-1">
        {PILLAR_ORDER.map((p) => (
          <button
            key={p}
            onClick={() => setActive(p)}
            className="flex-1 rounded-sm px-[10px] py-2 text-[13px] font-semibold"
            style={{
              background: active === p ? "#fffdf9" : "transparent",
              color: active === p ? "#22201c" : "#6b665d",
            }}
          >
            {PILLARS[p].label}
          </button>
        ))}
      </div>

      <div className="grid h-[180px] grid-cols-6 items-end gap-[10px]">
        {current?.points.map((pt) => (
          <div key={pt.weekLabel} className="flex h-full flex-col items-center justify-end gap-2">
            <div className="text-[13px] font-semibold">{pt.value !== null ? pt.value.toFixed(1) : "–"}</div>
            <div
              className="w-full rounded-[8px_8px_3px_3px] transition-[height] duration-[400ms]"
              style={{
                height: pt.value !== null ? `${(pt.value / 5) * 100}%` : "4%",
                background: pt.value !== null ? PILLARS[active].color : "#efece5",
              }}
            />
            <div className="text-xs text-muted">{pt.weekLabel}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-page px-4 py-[14px] text-sm leading-[1.5] text-insetText">
        {current?.insight || "Réponds à ton premier check-in pour voir ton évolution ici."}
      </div>
    </section>
  );
}
