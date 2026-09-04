"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

// Seletor de família — troca a URL (?family=…), quem monta a tabela é o
// server component. Estado na URL de propósito: link de família compartilha
// e volta pelo botão de voltar do celular (é assim que /market-shelf manda
// pra cá já com a família escolhida).
export function FamiliaSelect({
  familias,
  selecionada,
}: {
  familias: { nome: string; quantidade: number }[];
  selecionada: string;
}) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();

  return (
    <label className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
      family
      <select
        value={selecionada}
        disabled={pendente}
        onChange={(e) => {
          const valor = e.target.value;
          iniciarTransicao(() => {
            router.push(
              valor ? `/compare?family=${encodeURIComponent(valor)}` : "/compare",
            );
          });
        }}
        className="min-h-11 flex-1 rounded-md border border-slate-300 px-2 text-base text-slate-900 sm:min-h-9 sm:text-sm"
      >
        <option value="">choose a family…</option>
        {familias.map((familia) => (
          <option key={familia.nome} value={familia.nome}>
            {familia.nome} ({familia.quantidade})
          </option>
        ))}
      </select>
      {pendente && (
        <span role="status" className="text-slate-400">
          loading…
        </span>
      )}
    </label>
  );
}
