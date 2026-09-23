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
    // A manager who was reassigned away from their team (see the "Employés"
    // admin screen) has no team to show a dashboard for — a real, reachable
    // state now that reassignment exists, not just a defensive fallback.
    if (err instanceof ApiError) {
      return (
        <div className="rounded-2xl border border-dashed border-dottedLine px-6 py-10 text-center text-muted">
          {err.message} Contacte les RH pour qu&apos;on te réassigne une équipe.
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
