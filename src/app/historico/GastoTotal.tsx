"use client";

import { useMemo, useState } from "react";
import { formatMoeda, type Moeda } from "@/lib/moeda";
import { ProportionalBarList } from "@/components/ProportionalBarList";
import type { EventoSimples } from "./tipos";

type Visao = "loja" | "familia";

// Total + detalhamento proporcional (loja ou família) — recebe eventos JÁ
// filtrados pelo período ativo (dono é HistoricoClient); não tem mais
// estado de período próprio.
export function GastoTotal({
  eventos,
  moeda,
}: {
  eventos: EventoSimples[];
  moeda: Moeda;
}) {
  const [visao, setVisao] = useState<Visao>("loja");

  const total = eventos.reduce((acc, e) => acc + e.precoPago, 0);

  const linhas = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const e of eventos) {
      // "" = produto sem família (família deletada) — mesmo rótulo "other"
      // usado pra família com item único em market-shelf, pra não virar uma
      // barra com label em branco.
      const chave = visao === "loja" ? e.loja : e.productFamily || "other";
      mapa.set(chave, (mapa.get(chave) ?? 0) + e.precoPago);
    }
    const ordenado = Array.from(mapa.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
    if (ordenado.length <= 5) return ordenado;
    const top5 = ordenado.slice(0, 5);
    const outros = ordenado.slice(5).reduce((s, r) => s + r.value, 0);
    return [...top5, { label: "other", value: outros }];
  }, [eventos, visao]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">total spent</p>
      <p className="mt-1 font-display text-2xl font-bold tracking-tight tabular-nums text-slate-900">
        {formatMoeda(total, moeda)}
      </p>

      {eventos.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          no purchases in this period.
        </p>
      ) : (
        <>
          <div className="mt-3 flex gap-1">
            <button
              type="button"
              onClick={() => setVisao("loja")}
              className={`min-h-9 rounded-md px-2.5 text-xs font-medium ${
                visao === "loja"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              by store
            </button>
            <button
              type="button"
              onClick={() => setVisao("familia")}
              className={`min-h-9 rounded-md px-2.5 text-xs font-medium ${
                visao === "familia"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              by family
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            share of spend{visao === "familia" ? " by family" : ""} — not the
            same as "cheapest store" (each covers a different item mix)
          </p>
          <div className="mt-2">
            <ProportionalBarList rows={linhas} total={total} moeda={moeda} />
          </div>
        </>
      )}
    </section>
  );
}
