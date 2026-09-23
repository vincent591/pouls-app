"use client";

import { useMemo, useState } from "react";
import type { Pillar, QuestionType } from "@prisma/client";
import { PILLARS, PILLAR_ORDER } from "@/lib/pillars";
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
}

interface FlowItem {
  key: string;
  questionId: string;
  isFollowUp: boolean;
  pillar: Pillar;
  category: string;
  text: string;
  type: "scale" | "choice" | "text";
  low?: string;
  high?: string;
  options?: string[];
}

function buildFlow(questions: QuestionDTO[], answers: Record<string, number | string>): FlowItem[] {
  const flow: FlowItem[] = [];
  for (const q of questions) {
    flow.push({
      key: `${q.id}:b`,
      questionId: q.id,
      isFollowUp: false,
      pillar: q.pillar,
      category: q.category,
      text: q.text,
      type: q.type,
      low: q.lowLabel ?? undefined,
      high: q.highLabel ?? undefined,
      options: q.options,
    });
    const answer = answers[`${q.id}:b`];
    if (q.type === "scale" && q.followUp && typeof answer === "number" && answer <= 2) {
      flow.push({
        key: `${q.id}:f`,
        questionId: q.id,
        isFollowUp: true,
        pillar: q.pillar,
        category: `${q.category} · relance`,
        text: q.followUp.text,
        type: q.followUp.type,
        options: q.followUp.options,
      });
    }
  }
  return flow;
}

function formatAnswer(item: FlowItem, value: number | string | undefined): string {
  if (value === undefined || value === "") return "—";
  if (item.type === "scale") return `${value} / 5`;
  if (item.type === "text") return "Message envoyé";
  return String(value);
}

export default function CheckinFlow({
  firstName,
  weekLabel,
  alreadySubmitted,
  questions,
}: {
  firstName: string;
  weekLabel: string;
  alreadySubmitted: boolean;
  questions: QuestionDTO[];
}) {
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [anonymous, setAnonymous] = useState(true);
  const [done, setDone] = useState(alreadySubmitted);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const flow = useMemo(() => buildFlow(questions, answers), [questions, answers]);
  const n = flow.length;
  const cur = step >= 0 && step < n ? flow[step] : undefined;
  const curAnswer = cur ? answers[cur.key] : undefined;

  const pillarChips = PILLAR_ORDER.map((p) => ({
    pillar: p,
    count: questions.filter((q) => q.pillar === p).length,
  }));

  async function submit(finalAnswers: Record<string, number | string>) {
    setSubmitting(true);
    setSubmitError("");
    const payload = {
      anonymous,
      answers: Object.entries(finalAnswers).map(([key, value]) => {
        const [questionId, kind] = key.split(":");
        return { questionId, isFollowUp: kind === "f", value };
      }),
    };
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSubmitError(body.error ?? "Une erreur est survenue.");
      return;
    }
    setStep(n);
    setDone(true);
  }

  function pick(value: number | string) {
    if (!cur) return;
    setAnswers((a) => ({ ...a, [cur.key]: value }));
  }

  function next() {
    if (!cur) return;
    if (step === n - 1) {
      submit(answers);
      return;
    }
    setStep(step + 1);
  }

  if (done) {
    return (
      <section className="flex min-h-[460px] flex-col gap-[18px] rounded-2xl border border-border bg-surface p-7">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-success-bg text-2xl font-bold text-success-text">
          ✓
        </div>
        <h2 className="m-0 font-display text-[30px] tracking-[-0.015em]">Merci, c&apos;est noté.</h2>
        <p className="m-0 leading-[1.5] text-muted">
          {alreadySubmitted && step === -1
            ? "Tu as déjà répondu au check-in de cette semaine — reviens la semaine prochaine."
            : anonymous
              ? "Tes réponses ont été envoyées de façon anonyme. Ton manager ne voit que des tendances d'équipe."
              : "Tes réponses ont été envoyées avec ton nom."}
        </p>
        {step === n && n > 0 && (
          <div className="flex flex-col border-t border-border">
            {flow.map((item) => (
              <div
                key={item.key}
                className="flex justify-between gap-4 border-b border-border py-[10px] text-sm"
              >
                <span className="text-muted">
                  {PILLARS[item.pillar].label} · {item.category}
                </span>
                <span className="text-right font-semibold">{formatAnswer(item, answers[item.key])}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex-1" />
        {!alreadySubmitted && (
          <button
            onClick={() => {
              setStep(-1);
              setAnswers({});
              setDone(false);
            }}
            className="cursor-pointer rounded-lg border border-border bg-transparent py-[15px] text-[15px] font-semibold"
          >
            Refaire un check-in
          </button>
        )}
      </section>
    );
  }

  if (step === -1) {
    return (
      <section className="flex min-h-[460px] flex-col gap-[18px] rounded-2xl border border-border bg-surface p-7">
        <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-pillar-bienetre">
          Check-in · semaine {weekLabel.replace("S", "")}
        </div>
        <h1 className="m-0 font-display text-[36px] leading-[1.05] tracking-[-0.02em]">
          Salut {firstName}, comment ça va vraiment ?
        </h1>
        <p className="m-0 text-base leading-[1.5] text-muted">
          {questions.length} questions, environ 3 minutes, sur trois piliers : ton bien-être, ton
          engagement et ta performance.
        </p>
        <div className="flex flex-wrap gap-2">
          {pillarChips.map(({ pillar, count }) => (
            <div
              key={pillar}
              className="flex items-center gap-2 rounded-pill bg-page px-3 py-[7px] text-[13px] font-semibold"
            >
              <span
                className="h-[10px] w-[10px] rounded-full"
                style={{ background: PILLARS[pillar].color }}
              />
              {PILLARS[pillar].label} · {count}
            </div>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-[10px] rounded-md border border-border p-[12px_14px] text-sm">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-[18px] w-[18px] accent-pillar-bienetre"
          />
          <span>Répondre de façon anonyme</span>
        </label>
        <div className="flex-1" />
        <button
          onClick={() => {
            setAnswers({});
            setStep(0);
          }}
          className="cursor-pointer rounded-lg bg-ink py-4 text-base font-semibold text-surface"
        >
          Commencer
        </button>
      </section>
    );
  }

  if (!cur) return null;

  const nextDisabled = cur.type !== "text" && curAnswer === undefined;

  return (
    <section className="flex min-h-[460px] flex-col gap-[22px] rounded-2xl border border-border bg-surface p-7">
      <div className="flex flex-col gap-[10px]">
        <div className="flex justify-between text-[13px] text-muted">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: PILLARS[cur.pillar].color }} />
            <strong className="text-ink">{PILLARS[cur.pillar].label}</strong> · {cur.category}
          </span>
          <span>
            {step + 1} / {n}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded bg-subtle">
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${((step + 1) / Math.max(n, 1)) * 100}%`, background: PILLARS[cur.pillar].color }}
          />
        </div>
      </div>

      <h2 className="m-0 font-display text-[28px] leading-[1.15] tracking-[-0.015em]">{cur.text}</h2>

      {cur.type === "scale" && (
        <div className="flex flex-col gap-[10px]">
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((v) => {
              const selected = curAnswer === v;
              return (
                <button
                  key={v}
                  onClick={() => pick(v)}
                  className="aspect-square cursor-pointer rounded-lg border-[1.5px] text-xl font-semibold transition-all duration-150"
                  style={{
                    background: selected ? "#22201c" : "#fff",
                    color: selected ? "#fffdf9" : "#22201c",
                    borderColor: selected ? "#22201c" : "#e4e0d7",
                  }}
                >
                  {v}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[13px] text-muted">
            <span>{cur.low}</span>
            <span>{cur.high}</span>
          </div>
        </div>
      )}

      {cur.type === "choice" && (
        <div className="flex flex-col gap-2">
          {(cur.options ?? []).map((o) => {
            const selected = curAnswer === o;
            return (
              <button
                key={o}
                onClick={() => pick(o)}
                className="cursor-pointer rounded-lg border-[1.5px] px-4 py-[14px] text-left text-[15px] font-medium"
                style={{
                  background: selected ? "#22201c" : "#fff",
                  color: selected ? "#fffdf9" : "#22201c",
                  borderColor: selected ? "#22201c" : "#e4e0d7",
                }}
              >
                {o}
              </button>
            );
          })}
        </div>
      )}

      {cur.type === "text" && (
        <textarea
          value={typeof curAnswer === "string" ? curAnswer : ""}
          onChange={(e) => pick(e.target.value)}
          placeholder="Écris librement… (facultatif)"
          className="min-h-[140px] resize-y rounded-lg border-[1.5px] border-border bg-field p-[14px] text-[15px] leading-[1.5] outline-none"
        />
      )}

      {submitError && <div className="text-sm text-error">{submitError}</div>}

      <div className="flex-1" />
      <div className="flex gap-[10px]">
        <button
          onClick={() => setStep(step - 1)}
          className="cursor-pointer rounded-lg border border-border bg-transparent px-[18px] py-[15px] text-[15px] font-semibold"
        >
          Retour
        </button>
        <button
          onClick={next}
          disabled={nextDisabled || submitting}
          className="flex-1 cursor-pointer rounded-lg bg-ink py-[15px] text-[15px] font-semibold text-surface"
          style={{ opacity: nextDisabled ? 0.35 : 1 }}
        >
          {step === n - 1 ? "Envoyer" : "Suivant"}
        </button>
      </div>
    </section>
  );
}
