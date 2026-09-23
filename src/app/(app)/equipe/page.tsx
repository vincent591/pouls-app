import { ApiError, requireSpace, resolveDashboardTeamId } from "@/lib/access";
import { getDashboardData } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import Dashboard from "@/components/Dashboard";

export default async function EquipePage() {
  const session = await requireSpace("equipe");

  let teamId: string;
  try {
    teamId = await resolveDashboardTeamId(session, null);
  } catch (err) {
    // Two distinct empty states, both real/reachable (not just defensive):
    // a manager reassigned away from their team (see "Employés"), or — for
    // a brand-new org — an admin before any team exists at all. The admin
    // can fix the second one themselves; a manager can't, so only that case
    // points at HR.
    if (err instanceof ApiError) {
      const hint =
        session.user.role === "admin"
          ? "Crée ta première équipe depuis l'écran « Employés »."
          : "Contacte les RH pour qu'on te réassigne une équipe.";
      return (
        <div className="rounded-2xl border border-dashed border-dottedLine px-6 py-10 text-center text-muted">
          {err.message} {hint}
        </div>
      );
    }
    throw err;
  }

  const data = await getDashboardData(teamId);

  const isAdmin = session.user.role === "admin";
  const teams = isAdmin
    ? await prisma.team.findMany({
        where: { orgId: session.user.orgId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return <Dashboard initialData={data} isAdmin={isAdmin} teams={teams} />;
}
