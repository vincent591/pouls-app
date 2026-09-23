"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

interface DemoAccount {
  email: string;
  name: string;
  roleLabel: string;
}

export default function LoginCard({
  azureConfigured,
  googleConfigured,
  demoAccounts,
  callbackUrl,
}: {
  azureConfigured: boolean;
  googleConfigured: boolean;
  demoAccounts: DemoAccount[];
  callbackUrl: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  async function requestMagicLink() {
    if (!magicEmail.trim() || magicLoading) return;
    setMagicLoading(true);
    await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: magicEmail.trim() }),
    });
    setMagicLoading(false);
    setMagicSent(true);
  }

  async function submitDemo() {
    setError("");
    if (!email.trim()) return setError("Aucun compte avec cet e-mail.");
    if (!password) return setError("Saisis ton mot de passe.");
    setLoading(true);
    const res = await signIn("demo", { email: email.trim().toLowerCase(), password, redirect: false, callbackUrl });
    setLoading(false);
    if (res?.error) {
      setError("Aucun compte avec cet e-mail.");
      return;
    }
    window.location.href = res?.url ?? callbackUrl;
  }

  async function loginAs(demoEmail: string) {
    setLoading(true);
    const res = await signIn("demo", {
      email: demoEmail,
      password: "demo1234",
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (res?.url) window.location.href = res.url;
  }

  return (
    <section className="flex w-full max-w-[420px] flex-col gap-[18px] rounded-2xl border border-border bg-surface p-8">
      <div>
        <h1 className="m-0 font-display text-[30px] tracking-[-0.02em]">Connexion</h1>
        <div className="mt-[6px] text-[15px] leading-[1.45] text-muted">
          Chaque personne n&apos;accède qu&apos;à son espace. Les réponses individuelles ne sont
          jamais visibles par les managers.
        </div>
      </div>

      {(azureConfigured || googleConfigured) && (
        <div className="flex flex-col gap-2">
          {azureConfigured && (
            <button
              onClick={() => signIn("azure-ad", { callbackUrl })}
              className="cursor-pointer rounded-lg border border-border bg-field px-[13px] py-[13px] text-[15px] font-semibold text-ink"
            >
              Continuer avec Microsoft
            </button>
          )}
          {googleConfigured && (
            <button
              onClick={() => signIn("google", { callbackUrl })}
              className="cursor-pointer rounded-lg border border-border bg-field px-[13px] py-[13px] text-[15px] font-semibold text-ink"
            >
              Continuer avec Google
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-[10px]">
        {magicSent ? (
          <div className="rounded-md bg-page px-4 py-[14px] text-sm leading-[1.5] text-insetText">
            Si un compte existe avec cette adresse, un lien de connexion vient d&apos;être envoyé à{" "}
            <strong>{magicEmail.trim()}</strong>. Valable 15 minutes.
          </div>
        ) : (
          <>
            <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-muted">
              E-mail
              <input
                type="email"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && requestMagicLink()}
                placeholder="prenom@exemple.fr"
                className="rounded-md border-[1.5px] border-border p-[13px] text-[15px] text-ink outline-none"
              />
            </label>
            <button
              onClick={requestMagicLink}
              disabled={!magicEmail.trim() || magicLoading}
              className="cursor-pointer rounded-lg bg-ink py-[15px] text-[15px] font-semibold text-surface disabled:opacity-50"
            >
              Recevoir un lien de connexion
            </button>
          </>
        )}
      </div>

      {demoAccounts.length > 0 && (
        <div className="flex flex-col gap-[18px] border-t border-border pt-4">
          <div className="text-xs font-semibold text-muted">
            Mode démo (développement — à supprimer en production)
          </div>
          <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-muted">
            E-mail professionnel
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              placeholder="prenom@entreprise.fr"
              className="rounded-md border-[1.5px] border-border p-[13px] text-[15px] text-ink outline-none"
            />
          </label>
          <label className="flex flex-col gap-[6px] text-[13px] font-semibold text-muted">
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && submitDemo()}
              placeholder="••••••"
              className="rounded-md border-[1.5px] border-border p-[13px] text-[15px] text-ink outline-none"
            />
          </label>
          {error && <div className="text-sm text-error">{error}</div>}
          <button
            onClick={submitDemo}
            disabled={loading}
            className="cursor-pointer rounded-lg bg-ink py-[15px] text-[15px] font-semibold text-surface disabled:opacity-50"
          >
            Se connecter
          </button>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="text-[13px] font-semibold text-muted">Comptes de démo</div>
            {demoAccounts.map((a) => (
              <button
                key={a.email}
                onClick={() => loginAs(a.email)}
                disabled={loading}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-field px-[14px] py-[11px] text-left text-sm text-ink"
              >
                <span className="font-semibold">{a.name}</span>
                <span className="text-[13px] text-muted">{a.roleLabel}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
