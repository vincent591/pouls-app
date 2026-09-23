/**
 * Dev/demo seed: default questionnaire (README §"Questions par défaut"),
 * three demo-login accounts matching the design prototype's ACCOUNTS
 * (camille/julien/sarah, password "demo1234"), a second, smaller team to
 * demonstrate the k=5 anonymity threshold, and six weeks of historical
 * check-ins so the dashboard/trend/history views aren't empty on first run.
 * The current ISO week is left unanswered on purpose, for a live demo.
 *
 * Uses relative imports (not the "@/..." alias) since this file runs
 * standalone via `tsx`, outside Next.js's module resolution.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { submitCheckin, type SubmittedAnswer } from "../src/lib/checkin";
import { getIsoWeek, previousIsoWeek, type IsoWeek } from "../src/lib/isoWeek";
import type { Pillar, QuestionType, Question } from "@prisma/client";

interface SeedQuestion {
  pillar: Pillar;
  type: QuestionType;
  category: string;
  text: string;
  lowLabel?: string;
  highLabel?: string;
  options?: string[];
  followUp?: { type: "choice" | "text"; text: string; options?: string[] };
}

const DEFAULT_QUESTIONS: SeedQuestion[] = [
  {
    pillar: "bienetre",
    type: "scale",
    category: "Énergie",
    text: "Comment te sens-tu cette semaine ?",
    lowLabel: "Épuisé·e",
    highLabel: "En pleine forme",
    followUp: {
      type: "choice",
      text: "Qu'est-ce qui pèse le plus sur ton énergie ?",
      options: ["Le sommeil", "La charge de travail", "Des tensions dans l'équipe", "Ma vie perso"],
    },
  },
  {
    pillar: "bienetre",
    type: "scale",
    category: "Charge",
    text: "Ta charge de travail te semble…",
    lowLabel: "Écrasante",
    highLabel: "Très gérable",
    followUp: {
      type: "choice",
      text: "D'où vient surtout cette surcharge ?",
      options: ["Trop de projets en parallèle", "Des urgences imprévues", "Des délais trop courts", "Un manque de ressources"],
    },
  },
  {
    pillar: "engagement",
    type: "scale",
    category: "Motivation",
    text: "Te sens-tu motivé·e par tes missions ?",
    lowLabel: "Pas du tout",
    highLabel: "Énormément",
    followUp: { type: "text", text: "Qu'est-ce qui te redonnerait envie ?" },
  },
  {
    pillar: "engagement",
    type: "scale",
    category: "Appartenance",
    text: "Recommanderais-tu ton équipe à un·e ami·e ?",
    lowLabel: "Jamais",
    highLabel: "Sans hésiter",
  },
  {
    pillar: "performance",
    type: "scale",
    category: "Objectifs",
    text: "As-tu pu avancer sur tes priorités cette semaine ?",
    lowLabel: "Très peu",
    highLabel: "Complètement",
    followUp: { type: "text", text: "De quoi aurais-tu besoin pour avancer ?" },
  },
  {
    pillar: "performance",
    type: "choice",
    category: "Freins",
    text: "Qu'est-ce qui a le plus freiné ton travail ?",
    options: ["Trop de réunions", "Objectifs flous", "Manque d'outils", "Interruptions", "Rien de particulier"],
  },
  {
    pillar: "bienetre",
    type: "choice",
    category: "Besoins",
    text: "Qu'est-ce qui t'aiderait le plus en ce moment ?",
    options: ["Plus de flexibilité", "Moins de réunions", "Plus de reconnaissance", "Du temps pour me former"],
  },
  {
    pillar: "bienetre",
    type: "text",
    category: "Libre",
    text: "Un mot à partager, en toute confidentialité ?",
  },
];

const COMMENTS = [
  "Les réunions du lundi pourraient être plus courtes.",
  "Super ambiance depuis le séminaire !",
  "Un peu débordé·e avec la release, mais ça va.",
  "Merci pour la flexibilité sur les horaires.",
];

// Small deterministic PRNG (mulberry32) so re-seeding produces the same demo data.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "org-demo" },
    update: {},
    create: { id: "org-demo", name: "Entreprise Démo" },
  });

  const questions: Question[] = [];
  for (let i = 0; i < DEFAULT_QUESTIONS.length; i++) {
    const q = DEFAULT_QUESTIONS[i]!;
    const created = await prisma.question.upsert({
      where: { id: `q-${i + 1}` },
      update: {},
      create: {
        id: `q-${i + 1}`,
        orgId: org.id,
        pillar: q.pillar,
        type: q.type,
        text: q.text,
        category: q.category,
        lowLabel: q.lowLabel,
        highLabel: q.highLabel,
        options: q.options ?? [],
        followUp: q.followUp,
        position: i + 1,
        active: true,
      },
    });
    questions.push(created);
  }

  const demoPasswordHash = await bcrypt.hash("demo1234", 10);

  const produit = await prisma.team.upsert({
    where: { id: "team-produit" },
    update: {},
    create: { id: "team-produit", orgId: org.id, name: "Équipe Produit" },
  });
  const design = await prisma.team.upsert({
    where: { id: "team-design" },
    update: {},
    create: { id: "team-design", orgId: org.id, name: "Équipe Design" },
  });

  async function upsertUser(opts: {
    id: string;
    email: string;
    name: string;
    role: "employee" | "manager" | "admin";
    teamId: string | null;
    demo?: boolean;
  }) {
    return prisma.user.upsert({
      where: { email: opts.email },
      update: {},
      create: {
        id: opts.id,
        orgId: org.id,
        email: opts.email,
        name: opts.name,
        role: opts.role,
        teamId: opts.teamId,
        demoPasswordHash: opts.demo ? demoPasswordHash : null,
      },
    });
  }

  // The three demo-login accounts (mirror the design prototype's ACCOUNTS).
  const camille = await upsertUser({ id: "u-camille", email: "camille@entreprise.fr", name: "Camille Martin", role: "employee", teamId: produit.id, demo: true });
  const julien = await upsertUser({ id: "u-julien", email: "julien@entreprise.fr", name: "Julien Roux", role: "manager", teamId: produit.id, demo: true });
  const sarah = await upsertUser({ id: "u-sarah", email: "sarah@entreprise.fr", name: "Sarah Benali", role: "admin", teamId: null, demo: true });

  // Data-only teammates, so team Produit clears the k=5 anonymity threshold.
  const produitExtras = await Promise.all(
    [
      ["u-marc", "marc.dupont@entreprise.fr", "Marc Dupont"],
      ["u-lea", "lea.fontaine@entreprise.fr", "Léa Fontaine"],
      ["u-hugo", "hugo.lambert@entreprise.fr", "Hugo Lambert"],
      ["u-ines", "ines.moreau@entreprise.fr", "Inès Moreau"],
      ["u-thomas", "thomas.girard@entreprise.fr", "Thomas Girard"],
    ].map(([id, email, name]) => upsertUser({ id: id!, email: email!, name: name!, role: "employee", teamId: produit.id }))
  );

  await prisma.team.update({ where: { id: produit.id }, data: { managerId: julien.id } });

  // Team Design stays under 5 members on purpose — its dashboard should show
  // "n/d" almost everywhere, demonstrating the anonymity threshold.
  const nadia = await upsertUser({ id: "u-nadia", email: "nadia.chen@entreprise.fr", name: "Nadia Chen", role: "manager", teamId: design.id });
  const designExtras = await Promise.all(
    [
      ["u-paul", "paul.renard@entreprise.fr", "Paul Renard"],
      ["u-julie", "julie.petit@entreprise.fr", "Julie Petit"],
    ].map(([id, email, name]) => upsertUser({ id: id!, email: email!, name: name!, role: "employee", teamId: design.id }))
  );
  await prisma.team.update({ where: { id: design.id }, data: { managerId: nadia.id } });

  console.log("Seeded org, questions, teams, users. Generating 6 weeks of historical check-ins…");

  const produitMembers = [camille, julien, ...produitExtras];
  const designMembers = [nadia, ...designExtras];

  const currentWeek = getIsoWeek();
  const historicalWeeks: IsoWeek[] = [];
  let cursor = currentWeek;
  for (let i = 0; i < 6; i++) {
    cursor = previousIsoWeek(cursor);
    historicalWeeks.unshift(cursor);
  }

  async function seedTeamWeek(members: typeof produitMembers, week: IsoWeek, weekIndex: number, chargeDip: boolean) {
    for (let m = 0; m < members.length; m++) {
      const user = members[m]!;
      const rng = mulberry32(hashString(user.id) ^ (week.year * 100 + week.isoWeek));
      const base = 2.8 + weekIndex * 0.15;
      const answers: SubmittedAnswer[] = [];

      for (const q of questions) {
        if (q.type === "scale") {
          let bias = 0;
          if (q.category === "Charge") bias = -0.5 - (chargeDip ? 1.3 : 0);
          if (q.category === "Motivation") bias = 0.4;
          if (q.category === "Appartenance") bias = 0.6;
          if (q.category === "Objectifs") bias = 0.2;
          const raw = base + bias + (rng() - 0.5) * 2.2;
          const value = Math.max(1, Math.min(5, Math.round(raw)));
          answers.push({ questionId: q.id, isFollowUp: false, value });
          if (value <= 2 && q.followUp) {
            const followUp = q.followUp as unknown as { type: "choice" | "text"; options?: string[] };
            const value2 = followUp.type === "choice" && followUp.options?.length
              ? followUp.options[Math.floor(rng() * followUp.options.length)]!
              : "J'en parlerai au prochain point d'équipe.";
            answers.push({ questionId: q.id, isFollowUp: true, value: value2 });
          }
        } else if (q.type === "choice" && q.options.length) {
          answers.push({ questionId: q.id, isFollowUp: false, value: q.options[Math.floor(rng() * q.options.length)]! });
        } else if (q.type === "text" && m === 1) {
          answers.push({ questionId: q.id, isFollowUp: false, value: COMMENTS[weekIndex % COMMENTS.length]! });
        }
      }

      await submitCheckin(
        { userId: user.id, orgId: org.id, teamId: user.teamId, anonymous: rng() < 0.7, answers },
        week
      );
    }
  }

  for (let i = 0; i < historicalWeeks.length; i++) {
    const week = historicalWeeks[i]!;
    await seedTeamWeek(produitMembers, week, i, i === historicalWeeks.length - 1);
    if (designMembers.length) await seedTeamWeek(designMembers, week, i, false);
  }

  console.log("Seed complete.");
  console.log("Demo accounts (password: demo1234): camille@entreprise.fr, julien@entreprise.fr, sarah@entreprise.fr");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
