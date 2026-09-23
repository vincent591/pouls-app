import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse, requireApiSpace } from "@/lib/access";
import { createEmployee, type EmployeeInput } from "@/lib/employees";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireApiSpace("employes");
    const [employees, teams] = await Promise.all([
      prisma.user.findMany({
        where: { orgId: session.user.orgId },
        include: { team: { select: { id: true, name: true } }, managedTeam: { select: { id: true, name: true } } },
        orderBy: [{ active: "desc" }, { name: "asc" }],
      }),
      prisma.team.findMany({ where: { orgId: session.user.orgId }, orderBy: { name: "asc" } }),
    ]);
    return NextResponse.json({ employees, teams });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireApiSpace("employes");
    const body = (await req.json()) as EmployeeInput;
    const user = await createEmployee(session.user.orgId, body);
    const teams = await prisma.team.findMany({ where: { orgId: session.user.orgId }, orderBy: { name: "asc" } });
    return NextResponse.json({ employee: user, teams });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
