"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MOEDAS, type Moeda } from "@/lib/moeda";
import { useMoeda } from "@/components/MoedaContext";

// Moeda é configuração global (não por produto/loja) — troca aqui muda só
// a formatação/símbolo exibido em toda a UI, nunca converte valores já
// salvos (preços continuam os mesmos números no banco).
export function MoedaForm() {
  const router = useRouter();
  const moedaAtual = useMoeda();
  const [salvando, setSalvando] = useState<Moeda | null>(null);

  async function escolher(moeda: Moeda) {
    if (moeda === moedaAtual) return;
    setSalvando(moeda);
    try {
      await fetch("/api/configuracao", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moeda }),
      });
      router.refresh();
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {MOEDAS.map((m) => {
        const ativa = m.valor === moedaAtual;
        return (
          <button
            key={m.valor}
            type="button"
            onClick={() => escolher(m.valor)}
            disabled={salvando !== null}
            className={`min-h-11 rounded-md px-3 text-sm font-medium disabled:opacity-50 ${
              ativa
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {m.simbolo} {m.label}
          </button>
        );
      })}
    </div>
  );
}
