import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiSpace } from "@/lib/access";
import { getPersonalHistory } from "@/lib/checkin";

export async function GET() {
  try {
    const session = await requireApiSpace("employe");
    const history = await getPersonalHistory(session.user.id);
    return NextResponse.json({ history });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
