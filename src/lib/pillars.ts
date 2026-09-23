import type { Pillar } from "@prisma/client";

export const PILLARS: Record<Pillar, { label: string; color: string; tailwind: string }> = {
  bienetre: { label: "Bien-être", color: "oklch(0.6 0.1 155)", tailwind: "bg-pillar-bienetre" },
  engagement: { label: "Engagement", color: "oklch(0.6 0.1 265)", tailwind: "bg-pillar-engagement" },
  performance: { label: "Performance", color: "oklch(0.6 0.1 60)", tailwind: "bg-pillar-performance" },
};

export const PILLAR_ORDER: Pillar[] = ["bienetre", "engagement", "performance"];

export const ALERT_TIPS: Record<Pillar, string> = {
  bienetre: "Piste : revoir la répartition de la charge en réunion d'équipe.",
  engagement: "Piste : organiser un échange sur le sens des missions.",
  performance: "Piste : clarifier les priorités de la semaine.",
};

export const SCORE_GOOD = "oklch(0.62 0.1 155)";
export const SCORE_MID = "oklch(0.66 0.13 55)";
export const SCORE_LOW = "oklch(0.6 0.14 30)";

/** Colour-coding for a /5 average: ≥3.5 good, ≥2.8 mid, else low. */
export function colorForScore(avg: number): string {
  if (avg >= 3.5) return SCORE_GOOD;
  if (avg >= 2.8) return SCORE_MID;
  return SCORE_LOW;
}

export const ANONYMITY_THRESHOLD = 5;

export const TYPE_LABELS = {
  scale: "Échelle 1–5",
  choice: "Choix",
  text: "Texte libre",
} as const;
