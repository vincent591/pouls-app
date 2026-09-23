"use client";

import { useState } from "react";
import type { Pillar, QuestionType } from "@prisma/client";
import { PILLAR_ORDER, PILLARS, TYPE_LABELS } from "@/lib/pillars";
import type { FollowUp } from "@/lib/followUp";

interface QuestionDTO {
  id: string;
  pillar: Pillar;
  type: QuestionType;
  text: string;
  category: string;
  lowLabel: string | null;
  highLabel: string | null;
  options: string[];
  followUp: FollowUp | null;
  active: boolean;
}

interface Draft {
  pillar: Pillar;
  type: QuestionType;
  text: string;
  category: string;
  low: string;
  high: string;
  follow: string;
  options: string;
}

const emptyDraft = (): Draft => ({
  pillar: "bienetre",
  type: "scale",
  text: "",
  category: "",
  low: "",
  high: "",
  follow: "",
  options: "",
});

function detailFor(q: QuestionDTO): string {
  if (q.type === "scale") {
    return `${q.lowLabel} → ${q.highLabel}${q.followUp ? " · relance si ≤ 2" : ""}`;
  }
  if (q.type === "choice") return q.options.join(" · ");
  return "Réponse ouverte, facultative";
}

export default function QuestionnaireEditor({ initialQuestions }: { initialQuestions: QuestionDTO[] }) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [busy, setBusy] = useState(false);

  async function move(id: string, direction: "up" | "down") {
    const i = questions.findIndex((q) => q.id === id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setQuestions(next);
    await fetch("/api/questions/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, direction }),
    });
  }

  async function toggleActive(q: QuestionDTO) {
    setQuestions((qs) => qs.map((x) => (x.id === q.id ? { ...x, active: !x.active } : x)));
    await fetch(`/api/questions/${q.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !q.active }),
    });
  }

  async function remove(q: QuestionDTO) {
    setQuestions((qs) => qs.filter((x) => x.id !== q.id));
    await fetch(`/api/questions/${q.id}`, { method: "DELETE" });
  }

  const opts = draft.options
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const addOk = draft.text.trim().length > 0 && (draft.type !== "choice" || opts.length >= 2);

  async function addQuestion() {
    if (!addOk || busy) return;
    setBusy(true);
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pillar: draft.pillar,
        type: draft.type,
        text: draft.text,
        category: draft.category,
        lowLabel: draft.low,
        highLabel: draft.high,
        followUpText: draft.follow,
        options: opts,
      }),
    });
    setBusy(false);
    if (!res.ok) return;
    const { question } = await res.json();
    setQuestions((qs) => [...qs, question]);
    setDraft(emptyDraft());
  }

  return (
    <div
      className="grid items-start gap-6"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))" }}
    >
      <section className="flex flex-col gap-[14px]">
        <div>
          <h1 className="m-0 font-display text-[32px] tracking-[-0.02em]">Questionnaire</h1>
          <div className="mt-1 text-[15px] text-muted">
            Les changements s&apos;appliquent immédiatement au prochain check-in.
          </div>
        </div>
        {questions.map((q) => (
          <div
            key={q.id}
            className="flex items-start gap-[14px] rounded-lg border border-border bg-surface p-4"
            style={{ opacity: q.active ? 1 : 0.5 }}
          >
            <div className="flex flex-col gap-[2px]">
              <button
                onClick={() => move(q.id, "up")}
                className="h-6 w-7 cursor-pointer rounded border border-border bg-transparent text-[11px]"
              >
                ▲
              </button>
              <button
                onClick={() => move(q.id, "down")}
                className="h-6 w-7 cursor-pointer rounded border border-border bg-transparent text-[11px]"
              >
                ▼
              </button>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
              <div className="flex flex-wrap gap-[6px]">
                <span
                  className="rounded-pill px-2 py-[3px] text-[11px] font-semibold text-surface"
                  style={{ background: PILLARS[q.pillar].color }}
                >
                  {PILLARS[q.pillar].label}
                </span>
                <span className="rounded-pill border border-border px-2 py-[3px] text-[11px] font-semibold text-muted">
                  {TYPE_LABELS[q.type]}
                </span>
                <span className="rounded-pill bg-subtle px-2 py-[3px] text-[11px] font-semibold text-muted">
                  {q.category}
                </span>
              </div>
              <div className="text-[15px] font-medium leading-[1.35]">{q.text}</div>
              <div className="text-[13px] text-muted">{detailFor(q)}</div>
            </div>
            <div className="flex flex-col items-end gap-[6px]">
              <button
                onClick={() => toggleActive(q)}
                className="cursor-pointer rounded-md border border-border bg-transparent px-[10px] py-[6px] text-[13px] font-semibold"
              >
                {q.active ? "Désactiver" : "Activer"}
              </button>
              <button
                onClick={() => remove(q)}
                className="cursor-pointer border-0 bg-transparent p-1 text-[13px] text-error"
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="sticky top-6 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        <div className="font-display text-xl font-bold">Nouvelle question</div>

        <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-muted">
          Pilier
          <div className="flex flex-wrap gap-[6px]">
            {PILLAR_ORDER.map((p) => (
              <button
                key={p}
                onClick={() => setDraft((d) => ({ ...d, pillar: p }))}
                className="cursor-pointer rounded-md border-[1.5px] px-3 py-2 text-sm font-medium text-ink"
                style={{
                  background: draft.pillar === p ? "oklch(0.96 0.02 155)" : "#fff",
                  borderColor: draft.pillar === p ? PILLARS[p].color : "#e4e0d7",
                }}
              >
                {PILLARS[p].label}
              </button>
            ))}
          </div>
        </label>

        <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-muted">
          Type
          <div className="flex flex-wrap gap-[6px]">
            {(Object.entries(TYPE_LABELS) as [QuestionType, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setDraft((d) => ({ ...d, type: k }))}
                className="cursor-pointer rounded-md border-[1.5px] px-3 py-2 text-sm font-medium text-ink"
                style={{
                  background: draft.type === k ? "oklch(0.94 0.03 155)" : "#fff",
                  borderColor: draft.type === k ? "oklch(0.62 0.1 155)" : "#e4e0d7",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </label>

        <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-muted">
          Question
          <input
            value={draft.text}
            onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
            placeholder="Ex. As-tu pu déconnecter ce week-end ?"
            className="rounded-md border-[1.5px] border-border p-3 text-[15px] text-ink outline-none"
          />
        </label>

        <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-muted">
          Thème
          <input
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            placeholder="Ex. Équilibre"
            className="rounded-md border-[1.5px] border-border p-3 text-[15px] text-ink outline-none"
          />
        </label>

        {draft.type === "scale" && (
          <>
            <div className="grid grid-cols-2 gap-[10px]">
              <label className="flex min-w-0 flex-col gap-[6px] text-[13px] font-semibold text-muted">
                Libellé 1
                <input
                  value={draft.low}
                  onChange={(e) => setDraft((d) => ({ ...d, low: e.target.value }))}
                  placeholder="Pas du tout"
                  className="min-w-0 rounded-md border-[1.5px] border-border p-3 text-sm text-ink outline-none"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-[6px] text-[13px] font-semibold text-muted">
                Libellé 5
                <input
                  value={draft.high}
                  onChange={(e) => setDraft((d) => ({ ...d, high: e.target.value }))}
                  placeholder="Tout à fait"
                  className="min-w-0 rounded-md border-[1.5px] border-border p-3 text-sm text-ink outline-none"
                />
              </label>
            </div>
            <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-muted">
              Relance si score ≤ 2 (facultatif)
              <input
                value={draft.follow}
                onChange={(e) => setDraft((d) => ({ ...d, follow: e.target.value }))}
                placeholder="Ex. Qu'est-ce qui t'en empêche ?"
                className="rounded-md border-[1.5px] border-border p-3 text-sm text-ink outline-none"
              />
            </label>
          </>
        )}

        {draft.type === "choice" && (
          <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-muted">
            Réponses (une par ligne)
            <textarea
              value={draft.options}
              onChange={(e) => setDraft((d) => ({ ...d, options: e.target.value }))}
              placeholder={"Oui\nNon\nParfois"}
              className="min-h-[100px] resize-y rounded-md border-[1.5px] border-border p-3 text-sm text-ink outline-none"
            />
          </label>
        )}

        <button
          onClick={addQuestion}
          disabled={!addOk || busy}
          className="cursor-pointer rounded-lg bg-ink py-[14px] text-[15px] font-semibold text-surface"
          style={{ opacity: addOk ? 1 : 0.35 }}
        >
          Ajouter au questionnaire
        </button>
      </section>
    </div>
  );
}
