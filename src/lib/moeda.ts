import type { Moeda } from "@prisma/client";
import { prisma } from "./prisma";

export type { Moeda };

export const MOEDAS: { valor: Moeda; label: string; simbolo: string }[] = [
  { valor: "BRL", label: "real (BRL)", simbolo: "R$" },
  { valor: "USD", label: "us dollar (USD)", simbolo: "$" },
  { valor: "EUR", label: "euro (EUR)", simbolo: "€" },
  { valor: "GBP", label: "british pound (GBP)", simbolo: "£" },
];

const LOCALE_POR_MOEDA: Record<Moeda, string> = {
  BRL: "pt-BR",
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
};

export function formatMoeda(valor: number, moeda: Moeda) {
  return valor.toLocaleString(LOCALE_POR_MOEDA[moeda], {
    style: "currency",
    currency: moeda,
  });
}

export function simboloMoeda(moeda: Moeda) {
  return MOEDAS.find((m) => m.valor === moeda)?.simbolo ?? moeda;
}

// Server-side only (usa Prisma direto) — lê a moeda configurada. Sem
// registro ainda (nunca trocada) = default BRL, sem precisar de seed.
export async function getMoedaAtual(): Promise<Moeda> {
  const config = await prisma.configuracao.findUnique({
    where: { id: "singleton" },
  });
  return config?.moeda ?? "BRL";
}
