import { getSession, SPACE_ACCESS, SPACE_LABEL } from "@/lib/access";
import NavTabs from "@/components/NavTabs";
import LogoutButton from "@/components/LogoutButton";

const ROLE_LABEL = {
  employee: "Employé·e",
  manager: "Manager",
  admin: "RH · Admin",
};

export default async function Header() {
  const session = await getSession();
  // A session with no role means the account was deactivated after the JWT
  // was issued (see auth.ts's jwt() callback) — render as signed out.
  const activeSession = session?.user.role ? session : null;
  const tabs = activeSession
    ? SPACE_ACCESS[activeSession.user.role].map((space) => ({
        href: `/${space}`,
        label: SPACE_LABEL[activeSession.user.role][space],
      }))
    : [];

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface px-7 py-[18px]">
      <div className="flex items-center gap-[10px]">
        <div className="h-7 w-7 rounded-full bg-pillar-bienetre" />
        <div className="font-display text-xl font-bold tracking-[-0.02em]">Pouls</div>
        <div className="text-[13px] text-muted">bien-être · engagement · performance</div>
      </div>

      {tabs.length > 1 && <NavTabs tabs={tabs} />}

      {activeSession && (
        <div className="flex items-center gap-3">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-subtle text-[13px] font-semibold">
            {activeSession.user.name
              ?.split(" ")
              .map((s) => s[0])
              .join("")}
          </div>
          <div className="flex flex-col leading-[1.25]">
            <span className="text-sm font-semibold">{activeSession.user.name}</span>
            <span className="text-xs text-muted">{ROLE_LABEL[activeSession.user.role]}</span>
          </div>
          <LogoutButton />
        </div>
      )}
    </header>
  );
}
