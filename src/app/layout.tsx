import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";
import { getMoedaAtual } from "@/lib/moeda";
import { MoedaProvider } from "@/components/MoedaContext";
import { AppNav } from "@/components/AppNav";
import { NAV_ITEMS } from "@/lib/nav";
import "./globals.css";

// Par tipográfico "Stall": Bricolage Grotesque dá caráter aos títulos,
// Public Sans (desenhada para interface, com números tabulares muito
// bons) carrega todo o resto. Ambas variáveis, então não precisam de
// lista de pesos. next/font baixa e serve as duas do próprio domínio —
// sem request pro Google em runtime, sem layout shift.
const displayFace = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
});

const bodyFace = Public_Sans({
  subsets: ["latin"],
  variable: "--font-body-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "grocery list",
  description: "personal tracker for stock, shopping list, and spend by store.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const moeda = await getMoedaAtual();

  return (
    <html
      lang="en"
      className={`${displayFace.variable} ${bodyFace.variable}`}
    >
      <body className="min-h-screen antialiased">
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
          {/* Header com nav completa só em telas sm+ — no mobile a
              navegação vira a bottom nav fixa (AppNav), mais alcançável
              com o polegar enquanto anda pelo mercado. */}
          <header className="hidden border-b border-slate-200 bg-white sm:block">
            <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-display text-base font-bold tracking-tight text-slate-900">
                grocery list
              </span>
              <nav className="flex flex-wrap gap-1">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:text-sm"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="flex-1 px-4 pb-24 pt-4 sm:pb-4">
            <MoedaProvider moeda={moeda}>{children}</MoedaProvider>
          </main>
          <AppNav />
        </div>
      </body>
    </html>
  );
}
