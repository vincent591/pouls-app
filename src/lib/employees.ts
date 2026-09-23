import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./access";

// Backs the "Employés" admin screen (added after the original design
// handoff — HR needs a way to provision accounts, since sign-in only ever
// succeeds for an e-mail that already exists in `User`, see auth.ts).

export interface EmployeeInput {
  name?: string;
  email?: string;
  role?: Role;
  teamId?: string | null;
  newTeamName?: string;
  /** When true, this user becomes their team's manager (Team.managerId), reassigning it if already set. */
  becomeManager?: boolean;
  active?: boolean;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";
}

async function resolveTeamId(
  orgId: string,
  input: Pick<EmployeeInput, "teamId" | "newTeamName">
): Promise<string | null> {
  if (input.newTeamName?.trim()) {
    const team = await prisma.team.create({ data: { orgId, name: input.newTeamName.trim() } });
    return team.id;
  }
  if (input.teamId) {
    const team = await prisma.team.findFirst({ where: { id: input.teamId, orgId } });
    if (!team) throw new ApiError(404, "Équipe introuvable.");
    return team.id;
  }
  return null;
}

/** Unassigns `userId` as manager of whichever team currently has them (no-op if none). */
async function clearManagerOf(userId: string) {
  const managed = await prisma.team.findUnique({ where: { managerId: userId } });
  if (managed) await prisma.team.update({ where: { id: managed.id }, data: { managerId: null } });
}

export async function createEmployee(orgId: string, input: EmployeeInput) {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name) throw new ApiError(400, "Le nom est requis.");
  if (!email) throw new ApiError(400, "L'e-mail est requis.");
  const role = input.role ?? "employee";

  const teamId = role === "admin" ? null : await resolveTeamId(orgId, input);
  if (role !== "admin" && !teamId) throw new ApiError(400, "Une équipe est requise pour ce rôle.");

  let user;
  try {
    user = await prisma.user.create({ data: { orgId, name, email, role, teamId } });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, "Cet e-mail est déjà utilisé.");
    throw err;
  }

  if (role === "manager" && input.becomeManager && teamId) {
    await prisma.team.update({ where: { id: teamId }, data: { managerId: user.id } });
  }

  return user;
}

export async function updateEmployee(orgId: string, id: string, input: EmployeeInput) {
  const existing = await prisma.user.findFirst({ where: { id, orgId } });
  if (!existing) throw new ApiError(404, "Employé introuvable.");

  const nextRole = input.role ?? existing.role;
  const data: Parameters<typeof prisma.user.update>[0]["data"] = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.email !== undefined) data.email = input.email.trim().toLowerCase();
  if (input.role !== undefined) data.role = input.role;
  if (input.active !== undefined) data.active = input.active;

  if (nextRole === "admin") {
    data.teamId = null;
  } else if (input.teamId !== undefined || input.newTeamName) {
    data.teamId = await resolveTeamId(orgId, input);
  }

  let user;
  try {
    user = await prisma.user.update({ where: { id }, data });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, "Cet e-mail est déjà utilisé.");
    throw err;
  }

  if (nextRole !== "manager" && existing.role === "manager") {
    await clearManagerOf(user.id);
  } else if (nextRole === "manager" && input.becomeManager && user.teamId) {
    await prisma.team.update({ where: { id: user.teamId }, data: { managerId: user.id } });
  } else if (nextRole === "manager" && input.becomeManager === false) {
    await clearManagerOf(user.id);
  }

  return user;
}
