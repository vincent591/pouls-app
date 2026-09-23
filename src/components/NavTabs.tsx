"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 rounded-md bg-subtle p-1">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-sm px-[14px] py-2 text-sm font-semibold ${
              active ? "bg-surface text-ink" : "bg-transparent text-muted"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
