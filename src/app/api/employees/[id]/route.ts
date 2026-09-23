import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse, requireApiSpace } from "@/lib/access";
import { updateEmployee, type EmployeeInput } from "@/lib/employees";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireApiSpace("employes");
    const body = (await req.json()) as EmployeeInput;
    const user = await updateEmployee(session.user.orgId, params.id, body);
    const teams = await prisma.team.findMany({ where: { orgId: session.user.orgId }, orderBy: { name: "asc" } });
    return NextResponse.json({ employee: user, teams });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
