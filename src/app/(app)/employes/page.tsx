import { requireSpace } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import EmployeesAdmin from "@/components/EmployeesAdmin";

export default async function EmployeesPage() {
  const session = await requireSpace("employes");
  const [employees, teams] = await Promise.all([
    prisma.user.findMany({
      where: { orgId: session.user.orgId },
      include: { team: { select: { id: true, name: true } }, managedTeam: { select: { id: true, name: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.team.findMany({ where: { orgId: session.user.orgId }, orderBy: { name: "asc" } }),
  ]);

  return <EmployeesAdmin initialEmployees={employees} initialTeams={teams} />;
}
