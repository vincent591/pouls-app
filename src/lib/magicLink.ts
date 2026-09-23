import crypto from "crypto";
import { prisma } from "./prisma";

// Passwordless sign-in for orgs without managed SSO (Entra ID / Google
// Workspace) — employees only have personal e-mail addresses. The raw token
// is only ever held in memory and in the e-mail itself; the DB stores a
// SHA-256 hash, so a DB leak alone can't be used to sign in as anyone.
const TOKEN_TTL_MS = 15 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createLoginToken(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.loginToken.create({
    data: {
      email: email.trim().toLowerCase(),
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return token;
}

/** One-time use: returns false (and does nothing further) for an unknown, already-used, mismatched, or expired token. */
export async function consumeLoginToken(email: string, token: string): Promise<boolean> {
  const record = await prisma.loginToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record) return false;
  if (record.usedAt) return false;
  if (record.expiresAt.getTime() < Date.now()) return false;
  if (record.email !== email.trim().toLowerCase()) return false;
  await prisma.loginToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return true;
}

export async function sendMagicLinkEmail(email: string, token: string) {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const url = `${base}/login/verify?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  const text = `Clique sur ce lien pour te connecter à Pouls (valable 15 minutes) :\n\n${url}\n\nSi tu n'es pas à l'origine de cette demande, ignore simplement cet e-mail.`;

  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "Pouls <onboarding@resend.dev>",
        to: email,
        subject: "Ton lien de connexion Pouls",
        text,
      }),
    });
    if (!res.ok) {
      // Don't throw: the caller (POST /api/auth/magic-link) always returns
      // the same generic response regardless of send success, to avoid
      // leaking which e-mails have an account — but a silent failure here
      // would otherwise be invisible, so at least log it.
      console.error(`sendMagicLinkEmail: Resend returned ${res.status}`, await res.text().catch(() => ""));
    }
  } else {
    console.info(`[magic-link:dev] ${url}`);
  }
}
