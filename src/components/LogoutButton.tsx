"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="cursor-pointer rounded-lg border border-border bg-transparent px-[11px] py-[7px] text-[13px] font-semibold text-ink"
    >
      Déconnexion
    </button>
  );
}
