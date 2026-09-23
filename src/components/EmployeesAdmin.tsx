"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";

interface TeamDTO {
  id: string;
  name: string;
}

interface EmployeeDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  teamId: string | null;
  team: TeamDTO | null;
  managedTeam: TeamDTO | null;
}

const ROLE_LABEL: Record<Role, string> = { employee: "Employé·e", manager: "Manager", admin: "RH · Admin" };
const ROLE_ORDER: Role[] = ["employee", "manager", "admin"];

function emptyDraft() {
  return { name: "", email: "", role: "employee" as Role, teamId: "", newTeamName: "", becomeManager: false };
}

export default function EmployeesAdmin({
  initialEmployees,
  initialTeams,
}: {
  initialEmployees: EmployeeDTO[];
  initialTeams: TeamDTO[];
}) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [teams, setTeams] = useState(initialTeams);
  const [draft, setDraft] = useState(emptyDraft());
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const addOk = draft.name.trim() && draft.email.trim() && (draft.role === "admin" || draft.teamId || draft.newTeamName.trim());

  async function addEmployee() {
    if (!addOk || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        email: draft.email,
        role: draft.role,
        teamId: draft.newTeamName.trim() ? undefined : draft.teamId || undefined,
        newTeamName: draft.newTeamName.trim() || undefined,
        becomeManager: draft.role === "manager" ? draft.becomeManager : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Une erreur est survenue.");
      return;
    }
    const { employee, teams: nextTeams } = await res.json();
    setTeams(nextTeams);
    setEmployees((emps) =>
      [...emps, { ...employee, team: nextTeams.find((t: TeamDTO) => t.id === employee.teamId) ?? null, managedTeam: null }].sort(
        (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)
      )
    );
    setDraft(emptyDraft());
    setCreatingTeam(false);
  }

  async function toggleActive(emp: EmployeeDTO) {
    setEmployees((emps) => emps.map((e) => (e.id === emp.id ? { ...e, active: !e.active } : e)));
    await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !emp.active }),
    });
  }

  async function saveEdit(emp: EmployeeDTO, patch: { role: Role; teamId: string; newTeamName: string; becomeManager: boolean }) {
    setBusy(true);
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: patch.role,
        teamId: patch.newTeamName.trim() ? undefined : patch.teamId || null,
        newTeamName: patch.newTeamName.trim() || undefined,
        becomeManager: patch.role === "manager" ? patch.becomeManager : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) return;
    const { employee, teams: nextTeams } = await res.json();
    setTeams(nextTeams);
    setEmployees((emps) =>
      emps.map((e) =>
        e.id === emp.id
          ? { ...e, ...employee, team: nextTeams.find((t: TeamDTO) => t.id === employee.teamId) ?? null }
          : e.managedTeam?.id === employee.teamId && employee.role === "manager"
            ? { ...e, managedTeam: null } // previous manager of that team, if any, lost it
            : e
      )
    );
    setEditingId(null);
  }

  return (
    <div className="grid items-start gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))" }}>
      <section className="flex flex-col gap-[14px]">
        <div>
          <h1 className="m-0 font-display text-[32px] tracking-[-0.02em]">Employés</h1>
          <div className="mt-1 text-[15px] text-muted">
            Un compte doit exister ici avant que la personne puisse se connecter (démo ou SSO).
          </div>
        </div>
        {employees.map((emp) => (
          <div
            key={emp.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
            style={{ opacity: emp.active ? 1 : 0.5 }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold">{emp.name}</span>
                  <span className="rounded-pill bg-subtle px-2 py-[2px] text-[11px] font-semibold text-muted">
                    {ROLE_LABEL[emp.role]}
                  </span>
                  {!emp.active && (
                    <span className="rounded-pill bg-subtle px-2 py-[2px] text-[11px] font-semibold text-error">
                      Désactivé
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-muted">{emp.email}</div>
                <div className="text-[13px] text-muted">
                  {emp.role === "admin" ? "Toutes les équipes" : (emp.team?.name ?? "Aucune équipe")}
                  {emp.managedTeam && ` · responsable de ${emp.managedTeam.name}`}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingId(editingId === emp.id ? null : emp.id)}
                  className="cursor-pointer rounded-md border border-border bg-transparent px-[10px] py-[6px] text-[13px] font-semibold"
                >
                  {editingId === emp.id ? "Fermer" : "Modifier"}
                </button>
                <button
                  onClick={() => toggleActive(emp)}
                  className="cursor-pointer rounded-md border border-border bg-transparent px-[10px] py-[6px] text-[13px] font-semibold"
                >
                  {emp.active ? "Désactiver" : "Réactiver"}
                </button>
              </div>
            </div>
            {editingId === emp.id && <EditPanel employee={emp} teams={teams} busy={busy} onSave={(patch) => saveEdit(emp, patch)} />}
          </div>
        ))}
      </section>

      <section className="sticky top-6 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        <div className="font-display text-xl font-bold">Nouvel employé</div>

        <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-muted">
          Nom
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Ex. Nadia Chen"
            className="rounded-md border-[1.5px] border-border p-3 text-[15px] text-ink outline-none"
          />
        </label>

        <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-muted">
          E-mail professionnel
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            placeholder="prenom@entreprise.fr"
            className="rounded-md border-[1.5px] border-border p-3 text-[15px] text-ink outline-none"
          />
        </label>

        <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-muted">
          Rôle
          <div className="flex flex-wrap gap-[6px]">
            {ROLE_ORDER.map((r) => (
              <button
                key={r}
                onClick={() => setDraft((d) => ({ ...d, role: r }))}
                className="cursor-pointer rounded-md border-[1.5px] px-3 py-2 text-sm font-medium text-ink"
                style={{
                  background: draft.role === r ? "oklch(0.96 0.02 155)" : "#fff",
                  borderColor: draft.role === r ? "oklch(0.62 0.1 155)" : "#e4e0d7",
                }}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </label>

        {draft.role !== "admin" && (
          <TeamPicker
            teamId={draft.teamId}
            newTeamName={draft.newTeamName}
            creatingTeam={creatingTeam}
            teams={teams}
            setCreatingTeam={setCreatingTeam}
            onChangeTeamId={(teamId) => setDraft((d) => ({ ...d, teamId }))}
            onChangeNewTeamName={(newTeamName) => setDraft((d) => ({ ...d, newTeamName }))}
          />
        )}

        {draft.role === "manager" && (
          <label className="flex items-center gap-[10px] text-sm">
            <input
              type="checkbox"
              checked={draft.becomeManager}
              onChange={(e) => setDraft((d) => ({ ...d, becomeManager: e.target.checked }))}
              className="h-[18px] w-[18px] accent-pillar-bienetre"
            />
            <span>Devient responsable de cette équipe (remplace le manager actuel s&apos;il y en a un)</span>
          </label>
        )}

        {error && <div className="text-sm text-error">{error}</div>}

        <button
          onClick={addEmployee}
          disabled={!addOk || busy}
          className="cursor-pointer rounded-lg bg-ink py-[14px] text-[15px] font-semibold text-surface"
          style={{ opacity: addOk ? 1 : 0.35 }}
        >
          Ajouter l&apos;employé
        </button>
      </section>
    </div>
  );
}

function TeamPicker({
  teamId,
  newTeamName,
  creatingTeam,
  teams,
  setCreatingTeam,
  onChangeTeamId,
  onChangeNewTeamName,
}: {
  teamId: string;
  newTeamName: string;
  creatingTeam: boolean;
  teams: TeamDTO[];
  setCreatingTeam: (v: boolean) => void;
  onChangeTeamId: (v: string) => void;
  onChangeNewTeamName: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-muted">
      Équipe
      {!creatingTeam ? (
        <div className="flex flex-col gap-[6px]">
          <select
            value={teamId}
            onChange={(e) => onChangeTeamId(e.target.value)}
            className="rounded-md border-[1.5px] border-border p-3 text-[15px] text-ink outline-none"
          >
            <option value="">Choisir une équipe…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setCreatingTeam(true)}
            className="w-fit cursor-pointer bg-transparent text-[13px] font-semibold text-ink underline"
          >
            + Nouvelle équipe
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-[6px]">
          <input
            value={newTeamName}
            onChange={(e) => onChangeNewTeamName(e.target.value)}
            placeholder="Ex. Équipe Design"
            className="rounded-md border-[1.5px] border-border p-3 text-[15px] text-ink outline-none"
          />
          <button
            onClick={() => {
              setCreatingTeam(false);
              onChangeNewTeamName("");
            }}
            className="w-fit cursor-pointer bg-transparent text-[13px] font-semibold text-muted underline"
          >
            Choisir une équipe existante
          </button>
        </div>
      )}
    </label>
  );
}

function EditPanel({
  employee,
  teams,
  busy,
  onSave,
}: {
  employee: EmployeeDTO;
  teams: TeamDTO[];
  busy: boolean;
  onSave: (patch: { role: Role; teamId: string; newTeamName: string; becomeManager: boolean }) => void;
}) {
  const [role, setRole] = useState<Role>(employee.role);
  const [teamId, setTeamId] = useState(employee.teamId ?? "");
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [becomeManager, setBecomeManager] = useState(!!employee.managedTeam);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-muted">
        Rôle
        <div className="flex flex-wrap gap-[6px]">
          {ROLE_ORDER.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className="cursor-pointer rounded-md border-[1.5px] px-3 py-2 text-sm font-medium text-ink"
              style={{
                background: role === r ? "oklch(0.96 0.02 155)" : "#fff",
                borderColor: role === r ? "oklch(0.62 0.1 155)" : "#e4e0d7",
              }}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </label>

      {role !== "admin" && (
        <TeamPicker
          teamId={teamId}
          newTeamName={newTeamName}
          creatingTeam={creatingTeam}
          teams={teams}
          setCreatingTeam={setCreatingTeam}
          onChangeTeamId={setTeamId}
          onChangeNewTeamName={setNewTeamName}
        />
      )}

      {role === "manager" && (
        <label className="flex items-center gap-[10px] text-sm">
          <input
            type="checkbox"
            checked={becomeManager}
            onChange={(e) => setBecomeManager(e.target.checked)}
            className="h-[18px] w-[18px] accent-pillar-bienetre"
          />
          <span>Responsable de cette équipe</span>
        </label>
      )}

      <button
        onClick={() => onSave({ role, teamId, newTeamName, becomeManager })}
        disabled={busy}
        className="cursor-pointer self-start rounded-md bg-ink px-4 py-2 text-[13px] font-semibold text-surface"
      >
        Enregistrer
      </button>
    </div>
  );
}
