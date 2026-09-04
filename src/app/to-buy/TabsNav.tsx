"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/to-buy", label: "editable" },
  { href: "/to-buy/sugestao", label: "suggested list" },
];

export function TabsNav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-slate-200">
      {TABS.map((tab) => {
        const ativa = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex min-h-11 items-center border-b-2 px-3 text-sm font-medium ${
              ativa
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
