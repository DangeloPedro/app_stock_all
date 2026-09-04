"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoeda, type Moeda } from "@/lib/moeda";
import type { EventoSimples } from "./tipos";
import { JANELAS } from "./janelas";
import { SeletorIntervalo, type IntervaloData } from "./SeletorIntervalo";
import { GastoTotal } from "./GastoTotal";
import { SpendTimeline } from "./SpendTimeline";
import { CompraItem } from "./CompraItem";
import { ExportHistorico, type CompraExport } from "./ExportHistorico";
import { agruparPorDiaELoja } from "./agrupar";

function formatDataCompra(iso: string) {
  // en-GB dá DD/MM/YYYY — mesma convenção usada em toda a página de
  // histórico (ver ExportHistorico.tsx e CompraItem.tsx).
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type Janela =
  | { tipo: "todos" }
  | { tipo: "dias"; dias: number }
  | { tipo: "customizado"; intervalo: IntervaloData };

function formatISO(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Dono único do período de navegação da página inteira — total, timeline,
// barras de gasto e a lista de compras visível usam todos o mesmo recorte
// (antes cada peça tinha seu próprio seletor independente, confuso). O
// painel de export (ExportHistorico) continua com seleção própria — só
// herda esse período como ponto de partida na primeira vez que abre.
export function HistoricoClient({
  eventos,
  compras,
  moeda,
}: {
  eventos: EventoSimples[];
  compras: CompraExport[];
  moeda: Moeda;
}) {
  const router = useRouter();
  const [janela, setJanela] = useState<Janela>({ tipo: "todos" });

  const limites = useMemo(() => {
    if (janela.tipo === "todos") return null;
    if (janela.tipo === "dias") {
      return {
        inicio: Date.now() - janela.dias * 24 * 60 * 60 * 1000,
        fim: Date.now(),
      };
    }
    return {
      inicio: new Date(`${janela.intervalo.inicio}T00:00:00`).getTime(),
      fim: new Date(`${janela.intervalo.fim}T23:59:59`).getTime(),
    };
  }, [janela]);

  const eventosFiltrados = useMemo(() => {
    if (!limites) return eventos;
    return eventos.filter((e) => {
      const t = new Date(e.data).getTime();
      return t >= limites.inicio && t <= limites.fim;
    });
  }, [eventos, limites]);

  const comprasFiltradas = useMemo(() => {
    if (!limites) return compras;
    return compras.filter((c) => {
      const t = new Date(c.dataISO).getTime();
      return t >= limites.inicio && t <= limites.fim;
    });
  }, [compras, limites]);

  // Mesma hierarquia dia → loja do painel de export, pra não ter duas
  // formas diferentes de agrupar a mesma coisa dentro de /historico.
  const gruposFiltrados = useMemo(
    () => agruparPorDiaELoja(comprasFiltradas),
    [comprasFiltradas],
  );

  // Comparação com o período anterior de mesma duração — só faz sentido
  // com um recorte concreto ("todos" não tem "período anterior").
  const totalPeriodoAnterior = useMemo(() => {
    if (!limites) return null;
    const duracao = limites.fim - limites.inicio;
    const inicioAnterior = limites.inicio - duracao;
    return eventos.reduce((acc, e) => {
      const t = new Date(e.data).getTime();
      return t >= inicioAnterior && t < limites.inicio ? acc + e.precoPago : acc;
    }, 0);
  }, [eventos, limites]);

  const intervaloAtual = janela.tipo === "customizado" ? janela.intervalo : null;

  const seedExport = limites
    ? {
        inicio: formatISO(new Date(limites.inicio)),
        fim: formatISO(new Date(limites.fim)),
      }
    : null;

  const totalAtual = eventosFiltrados.reduce((acc, e) => acc + e.precoPago, 0);
  const diferenca =
    totalPeriodoAnterior !== null ? totalAtual - totalPeriodoAnterior : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setJanela({ tipo: "todos" })}
          className={`min-h-9 rounded-md px-2.5 text-xs font-medium ${
            janela.tipo === "todos"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          all time
        </button>
        {JANELAS.map((j) => (
          <button
            key={j.label}
            type="button"
            onClick={() => setJanela({ tipo: "dias", dias: j.dias })}
            className={`min-h-9 rounded-md px-2.5 text-xs font-medium ${
              janela.tipo === "dias" && janela.dias === j.dias
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {j.label}
          </button>
        ))}
        <SeletorIntervalo
          value={intervaloAtual}
          onChange={(intervalo) => setJanela({ tipo: "customizado", intervalo })}
        />
      </div>

      <GastoTotal eventos={eventosFiltrados} moeda={moeda} />

      {diferenca !== null && (
        <p className="text-xs text-slate-500">
          vs. previous equal period:{" "}
          <span className="font-medium tabular-nums text-slate-700">
            {diferenca >= 0 ? "+" : ""}
            {formatMoeda(diferenca, moeda)}
          </span>
        </p>
      )}

      <SpendTimeline eventos={eventosFiltrados} moeda={moeda} />

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          purchases
        </h2>
        {comprasFiltradas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
            no purchases in this period.
          </p>
        ) : (
          <div className="space-y-2">
            {gruposFiltrados.map((dia) => {
              const totalDia = dia.lojas.reduce(
                (acc, l) => acc + l.itens.reduce((a, c) => a + c.total, 0),
                0,
              );
              return (
                <details
                  key={dia.dataISO}
                  open
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <summary className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                    <span className="flex-1 font-medium text-slate-900">
                      {formatDataCompra(dia.dataISO)}
                    </span>
                    <span className="font-semibold tabular-nums text-slate-900">
                      {formatMoeda(totalDia, moeda)}
                    </span>
                  </summary>

                  <div className="mt-2 space-y-3 border-t border-slate-100 pt-2">
                    {dia.lojas.map((grupoLoja) => {
                      const totalLoja = grupoLoja.itens.reduce(
                        (acc, c) => acc + c.total,
                        0,
                      );
                      return (
                        <div key={grupoLoja.loja} className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
                            <span>{grupoLoja.loja}</span>
                            <span className="tabular-nums">
                              {formatMoeda(totalLoja, moeda)}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {grupoLoja.itens.map((compra, indice) => (
                              <CompraItem
                                key={compra.chave}
                                compra={compra}
                                moeda={moeda}
                                titulo={
                                  grupoLoja.itens.length > 1
                                    ? `purchase ${grupoLoja.itens.length - indice}`
                                    : undefined
                                }
                                onExcluida={() => router.refresh()}
                                onDataAlterada={() => router.refresh()}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <ExportHistorico compras={compras} moeda={moeda} seedIntervalo={seedExport} />
    </div>
  );
}
