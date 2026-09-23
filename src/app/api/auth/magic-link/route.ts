import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLoginToken, sendMagicLinkEmail } from "@/lib/magicLink";

const GENERIC_RESPONSE = {
  ok: true,
  message: "Si un compte existe avec cette adresse, un lien de connexion vient d'être envoyé.",
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase();

  // Always return the same response whether or not the account exists —
  // otherwise this endpoint would let anyone probe which e-mails have an
  // account here.
  if (!email) return NextResponse.json(GENERIC_RESPONSE);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.active) {
    const token = await createLoginToken(email);
    await sendMagicLinkEmail(email, token);
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
