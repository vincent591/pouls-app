"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

export default function MagicLinkVerifier({ email, token }: { email: string | null; token: string | null }) {
  const [status, setStatus] = useState<"checking" | "error">("checking");

  useEffect(() => {
    if (!email || !token) {
      setStatus("error");
      return;
    }
    signIn("magic", { email, token, redirect: false })
      .then((res) => {
        if (res?.ok) {
          window.location.href = "/";
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [email, token]);

  return (
    <section className="flex w-full max-w-[420px] flex-col gap-[18px] rounded-2xl border border-border bg-surface p-8 text-center">
      {status === "checking" ? (
        <div className="text-[15px] text-muted">Connexion en cours…</div>
      ) : (
        <>
          <h1 className="m-0 font-display text-[24px] tracking-[-0.02em]">Lien invalide ou expiré</h1>
          <p className="m-0 text-[15px] leading-[1.45] text-muted">
            Ce lien n&apos;est plus valable (il n&apos;est utilisable qu&apos;une fois, pendant 15 minutes).
            Redemande-en un depuis la page de connexion.
          </p>
          <a
            href="/login"
            className="cursor-pointer rounded-lg bg-ink py-[13px] text-[15px] font-semibold text-surface no-underline"
          >
            Retour à la connexion
          </a>
        </>
      )}
    </section>
  );
}
