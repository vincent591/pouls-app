/**
 * Production bootstrap — creates the org, the default questionnaire, and
 * exactly one RH/admin account (no demo passwords, no fake teams/history).
 * Run once against the production database, then sign in with the admin
 * e-mail via the magic-link flow and use the "Employés" screen for everyone
 * else.
 *
 * Usage:
 *   DATABASE_URL="postgresql://…prod…" npx tsx prisma/init-prod.ts \
 *     --org "Entreprise SAS" --name "Prénom Nom" --email admin@exemple.fr
 *
 * Uses relative imports (not "@/…") — see prisma/seed.ts for why.
 */
import { prisma } from "../src/lib/prisma";

const DEFAULT_QUESTIONS = [
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
] as const;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const orgName = arg("org");
  const adminName = arg("name");
  const adminEmail = arg("email")?.trim().toLowerCase();

  if (!orgName || !adminName || !adminEmail) {
    console.error("Usage: npx tsx prisma/init-prod.ts --org \"Nom\" --name \"Prénom Nom\" --email admin@exemple.fr");
    process.exit(1);
  }

  const existingOrg = await prisma.organization.findFirst();
  if (existingOrg) {
    console.error(
      `Une organisation existe déjà ("${existingOrg.name}", id ${existingOrg.id}). ` +
        "Ce script est fait pour un premier démarrage à vide uniquement — utilise l'écran " +
        "\"Employés\" pour ajouter des comptes à une organisation existante."
    );
    process.exit(1);
  }

  const org = await prisma.organization.create({ data: { name: orgName } });

  for (let i = 0; i < DEFAULT_QUESTIONS.length; i++) {
    const q = DEFAULT_QUESTIONS[i]!;
    await prisma.question.create({
      data: {
        orgId: org.id,
        pillar: q.pillar,
        type: q.type,
        text: q.text,
        category: q.category,
        lowLabel: "lowLabel" in q ? q.lowLabel : undefined,
        highLabel: "highLabel" in q ? q.highLabel : undefined,
        options: "options" in q ? [...q.options] : [],
        followUp: "followUp" in q ? q.followUp : undefined,
        position: i + 1,
        active: true,
      },
    });
  }

  const admin = await prisma.user.create({
    data: { orgId: org.id, name: adminName, email: adminEmail, role: "admin", active: true },
  });

  console.log(`Organisation "${org.name}" créée (id ${org.id}).`);
  console.log(`Questionnaire par défaut créé (${DEFAULT_QUESTIONS.length} questions).`);
  console.log(`Compte RH/admin créé : ${admin.name} <${admin.email}>.`);
  console.log("Connecte-toi avec cette adresse via le lien magique, puis ajoute le reste de l'équipe depuis \"Employés\".");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
