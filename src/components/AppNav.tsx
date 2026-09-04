"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";

// Ícones inline (sem lib externa, ver revisão de design) — só o essencial
// pra caber rótulo curto + ícone em 5 colunas numa tela de celular.
function IconeCarrinho({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
      <path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.8h7.2a2 2 0 0 0 2-1.6L21 8H6" />
    </svg>
  );
}

function IconeCasa({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 8 12 3 3 8v11a1 1 0 0 0 1 1h5v-6h6v6h5a1 1 0 0 0 1-1z" />
    </svg>
  );
}

function IconeLoja({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 9 4 4h16l1 5" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M9 20v-6h6v6" />
      <path d="M3 9h18" />
    </svg>
  );
}

function IconeRecibo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

function IconeEngrenagem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
    </svg>
  );
}

const ICONES: Record<string, (props: { className?: string }) => React.JSX.Element> = {
  "/to-buy": IconeCarrinho,
  "/shelf": IconeCasa,
  "/market-shelf": IconeLoja,
  "/historico": IconeRecibo,
  "/configuracoes": IconeEngrenagem,
};

// Bottom nav — só mobile (escondida em sm: e acima, onde o header de
// layout.tsx assume). Fixa na base, com padding de safe-area pro home
// indicator do iPhone não cobrir os rótulos.
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      {NAV_ITEMS.map((item) => {
        const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icone = ICONES[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
              ativo ? "text-blue-600" : "text-slate-500"
            }`}
          >
            <Icone className="h-5 w-5" />
            {item.shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}
