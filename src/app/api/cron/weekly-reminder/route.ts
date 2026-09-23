import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIsoWeek } from "@/lib/isoWeek";

// README §"Rappels hebdo": "cron (ex. Vercel Cron) → e-mail (Resend) et/ou
// webhook Teams/Slack." Wire this path into vercel.json's `crons` (or any
// scheduler that can hit a URL on a schedule with the CRON_SECRET below).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const week = getIsoWeek();
  // Every employee/manager may fill in a check-in (README role table);
  // admins don't get a personal reminder.
  const candidates = await prisma.user.findMany({
    where: { role: { in: ["employee", "manager"] }, active: true },
    select: { id: true, email: true, name: true },
  });
  const receipts = await prisma.checkinReceipt.findMany({
    where: { isoWeek: week.isoWeek, year: week.year, userId: { in: candidates.map((c) => c.id) } },
    select: { userId: true },
  });
  const done = new Set(receipts.map((r) => r.userId));
  const pending = candidates.filter((c) => !done.has(c.id));

  let sent = 0;
  for (const user of pending) {
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Pouls <pouls@notifications.entreprise.fr>",
            to: user.email,
            subject: "Ton check-in Pouls de la semaine t'attend",
            text: `Salut ${user.name.split(" ")[0]}, quelques minutes suffisent pour ton check-in bien-être, engagement, performance de la semaine.`,
          }),
        });
        sent++;
      } catch (err) {
        console.error("weekly-reminder: Resend failed for", user.email, err);
      }
    } else {
      console.info(`[reminder:dev] would email ${user.email}`);
    }
  }

  return NextResponse.json({ pending: pending.length, sent });
}
