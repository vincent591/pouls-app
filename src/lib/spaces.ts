import type { Role } from "@prisma/client";

// Split out of access.ts on purpose: this file must stay free of any
// Node-only dependency (Prisma client, bcrypt, next-auth's Node internals)
// because src/middleware.ts imports it and middleware runs in the Edge
// Runtime. `import type` below is erased at compile time, so it's safe.
//
// Mirrors the prototype's `ALLOWED` map (Bien-etre App.dc.html) and the
// README's role table, plus "employes" — a people-management screen added
// after the original design handoff, admin-only.
export type Space = "employe" | "equipe" | "questionnaire" | "employes";

export const SPACE_ACCESS: Record<Role, Space[]> = {
  employee: ["employe"],
  manager: ["employe", "equipe"],
  admin: ["equipe", "employes", "questionnaire"],
};

export const SPACE_LABEL: Record<Role, Record<Space, string>> = {
  employee: { employe: "Employé", equipe: "", questionnaire: "", employes: "" },
  manager: { employe: "Mon check-in", equipe: "Mon équipe", questionnaire: "", employes: "" },
  admin: { employe: "", equipe: "Toutes les équipes", questionnaire: "Questionnaire", employes: "Employés" },
};

export function defaultSpaceFor(role: Role): Space {
  const first = SPACE_ACCESS[role][0];
  if (!first) throw new Error(`Role ${role} has no accessible space`);
  return first;
}

export function canAccessSpace(role: Role | undefined, space: Space): boolean {
  return !!role && SPACE_ACCESS[role].includes(space);
}
