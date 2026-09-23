import { requireSpace } from "@/lib/access";
import { getActiveQuestions, hasSubmittedThisWeek, getPersonalHistory } from "@/lib/checkin";
import { getIsoWeek, isoWeekLabel } from "@/lib/isoWeek";
import type { FollowUp } from "@/lib/followUp";
import CheckinFlow from "@/components/CheckinFlow";
import HistoryCard from "@/components/HistoryCard";

export default async function EmployeePage() {
  const session = await requireSpace("employe");
  const week = getIsoWeek();
  const [questions, alreadySubmitted, history] = await Promise.all([
    getActiveQuestions(session.user.orgId),
    hasSubmittedThisWeek(session.user.id, week),
    getPersonalHistory(session.user.id),
  ]);

  return (
    <div
      className="grid items-start gap-6"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}
    >
      <CheckinFlow
        firstName={session.user.name?.split(" ")[0] ?? ""}
        weekLabel={isoWeekLabel(week)}
        alreadySubmitted={alreadySubmitted}
        questions={questions.map((q) => ({ ...q, followUp: (q.followUp as unknown as FollowUp | null) ?? null }))}
      />
      <HistoryCard history={history} />
    </div>
  );
}
