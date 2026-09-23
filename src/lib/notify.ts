// Stub for README §"Manager / RH — Tableau de bord équipe": "Envoyer aussi une
// notification e-mail/Teams au manager." Wired up but inert until the
// relevant env vars are set — see .env.example.
export async function notifyManagerOfAlert(params: {
  managerEmail: string | null;
  teamName: string;
  title: string;
  body: string;
}) {
  const { managerEmail, teamName, title, body } = params;
  const text = `Pouls · ${teamName} — ${title}\n${body}`;

  if (process.env.TEAMS_WEBHOOK_URL) {
    try {
      await fetch(process.env.TEAMS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    } catch (err) {
      console.error("notifyManagerOfAlert: Teams webhook failed", err);
    }
  }

  if (process.env.RESEND_API_KEY && managerEmail) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Pouls <pouls@notifications.entreprise.fr>",
          to: managerEmail,
          subject: `Pouls · ${teamName} — ${title}`,
          text: body,
        }),
      });
    } catch (err) {
      console.error("notifyManagerOfAlert: Resend failed", err);
    }
  }

  if (!process.env.TEAMS_WEBHOOK_URL && !process.env.RESEND_API_KEY) {
    console.info(`[notify:dev] ${text}`);
  }
}
