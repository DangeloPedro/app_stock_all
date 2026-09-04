"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type Moeda } from "@/lib/moeda";
import { JANELAS } from "./janelas";
import { SeletorIntervalo, type IntervaloData } from "./SeletorIntervalo";
import { CompraItem } from "./CompraItem";
import { agruparPorDiaELoja } from "./agrupar";

export type CompraExport = {
  chave: string;
  dataISO: string; // yyyy-mm-dd, meia-noite local
  loja: string;
  total: number;
  itens: {
    id: string;
    produtoNome: string;
    productFamily: string;
    quantidadeComprada: number;
    precoPago: number;
  }[];
};

function formatData(iso: string) {
  // en-GB dá DD/MM/YYYY — é esse o formato que o app usa em qualquer lugar
  // que mostra data completa, independente de onde o servidor/navegador
  // rodar (en-US daria MM/DD/YYYY, ambíguo/errado pro usuário).
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function csvEscape(valor: string | number) {
  const texto = String(valor);
  if (/[;"\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

function chavesNoIntervalo(compras: CompraExport[], intervalo: IntervaloData) {
  const inicio = new Date(`${intervalo.inicio}T00:00:00`).getTime();
  const fim = new Date(`${intervalo.fim}T23:59:59`).getTime();
  return compras
    .filter((c) => {
      const t = new Date(c.dataISO).getTime();
      return t >= inicio && t <= fim;
    })
    .map((c) => c.chave);
}

// Checkbox de grupo (dia ou loja): reflete "todos selecionados" / "nenhum"
// / "alguns" (indeterminate não dá pra fazer só com o atributo `checked` —
// precisa mexer direto no DOM via ref).
function CheckboxDeGrupo({
  checked,
  indeterminado,
  onChange,
}: {
  checked: boolean;
  indeterminado: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminado;
  }, [indeterminado]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="h-5 w-5 shrink-0 accent-blue-600"
    />
  );
}

// Painel de export, recolhido por padrão — fica fora do caminho da
// navegação normal (que já mostra as compras via CompraItem, sem
// checkbox, em HistoricoClient). Abre com tudo selecionado (dia → loja →
// compra individual, cada nível com seu próprio checkbox liga-tudo); o
// período já navegado (seedIntervalo) só serve pra pré-marcar o botão de
// "custom range" — dali em diante a seleção é sempre independente do que
// está sendo visto na navegação normal.
export function ExportHistorico({
  compras,
  moeda,
  seedIntervalo,
}: {
  compras: CompraExport[];
  moeda: Moeda;
  seedIntervalo: IntervaloData | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  // Default: tudo selecionado — o usuário afina daqui pra baixo (por dia,
  // por loja, ou compra a compra), em vez de partir de uma seleção vazia.
  const [selecionadas, setSelecionadas] = useState<Set<string>>(
    () => new Set(compras.map((c) => c.chave)),
  );
  const [intervaloEscolhido, setIntervaloEscolhido] =
    useState<IntervaloData | null>(seedIntervalo);

  const todasChaves = useMemo(() => compras.map((c) => c.chave), [compras]);
  const todasSelecionadas =
    compras.length > 0 && selecionadas.size === compras.length;
  const grupos = useMemo(() => agruparPorDiaELoja(compras), [compras]);

  function toggle(chave: string) {
    setSelecionadas((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  }

  // Liga/desliga um bloco inteiro de chaves de uma vez (dia inteiro, ou
  // loja inteira dentro de um dia).
  function toggleGrupo(chaves: string[], marcar: boolean) {
    setSelecionadas((prev) => {
      const proximo = new Set(prev);
      for (const chave of chaves) {
        if (marcar) proximo.add(chave);
        else proximo.delete(chave);
      }
      return proximo;
    });
  }

  function selecionarTudo() {
    setSelecionadas(todasSelecionadas ? new Set() : new Set(todasChaves));
  }

  function selecionarJanela(dias: number) {
    const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
    const chaves = compras
      .filter((c) => new Date(c.dataISO).getTime() >= limite)
      .map((c) => c.chave);
    setSelecionadas(new Set(chaves));
  }

  function selecionarIntervalo(intervalo: IntervaloData) {
    setIntervaloEscolhido(intervalo);
    setSelecionadas(new Set(chavesNoIntervalo(compras, intervalo)));
  }

  function exportarCSV() {
    const alvo = compras.filter((c) => selecionadas.has(c.chave));
    const linhas = [
      ["Date", "Store", "Product", "Family", "Quantity", "Line Total", "Unit Price"].join(";"),
    ];
    for (const compra of alvo) {
      for (const item of compra.itens) {
        linhas.push(
          [
            formatData(compra.dataISO),
            compra.loja,
            item.produtoNome,
            item.productFamily,
            item.quantidadeComprada,
            item.precoPago.toFixed(2).replace(".", ","),
            (item.precoPago / item.quantidadeComprada).toFixed(2).replace(".", ","),
          ]
            .map(csvEscape)
            .join(";"),
        );
      }
    }
    // BOM ﻿ pro Excel reconhecer UTF-8 e não bagunçar acentos.
    const blob = new Blob(["﻿" + linhas.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const hoje = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `historico-compras-${hoje}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="min-h-11 w-full rounded-lg border border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 active:bg-slate-50"
      >
        export CSV…
      </button>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">export CSV</h2>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="min-h-9 px-2 text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          close
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {JANELAS.map((j) => (
          <button
            key={j.label}
            type="button"
            onClick={() => selecionarJanela(j.dias)}
            className="min-h-9 rounded-md bg-slate-100 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
          >
            {j.label}
          </button>
        ))}
        <SeletorIntervalo value={intervaloEscolhido} onChange={selecionarIntervalo} />
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={todasSelecionadas}
            onChange={selecionarTudo}
            className="h-5 w-5 accent-blue-600"
          />
          select all ({selecionadas.size}/{compras.length})
        </label>
        <button
          type="button"
          onClick={exportarCSV}
          disabled={selecionadas.size === 0}
          className="min-h-11 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40"
        >
          export CSV (Excel)
        </button>
      </div>

      <div className="space-y-2">
        {grupos.map((dia) => {
          const chavesDia = dia.lojas.flatMap((l) => l.itens.map((c) => c.chave));
          const marcadasDia = chavesDia.filter((k) => selecionadas.has(k)).length;
          return (
            <details
              key={dia.dataISO}
              open
              className="rounded-lg border border-slate-200 bg-white"
            >
              <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                <CheckboxDeGrupo
                  checked={marcadasDia === chavesDia.length}
                  indeterminado={marcadasDia > 0 && marcadasDia < chavesDia.length}
                  onChange={() =>
                    toggleGrupo(chavesDia, marcadasDia !== chavesDia.length)
                  }
                />
                <span className="flex-1 font-medium text-slate-900">
                  {formatData(dia.dataISO)}
                </span>
                <span className="text-xs text-slate-400">
                  {marcadasDia}/{chavesDia.length}
                </span>
              </summary>

              <div className="space-y-2 border-t border-slate-100 p-2">
                {dia.lojas.map((grupoLoja) => {
                  const chavesLoja = grupoLoja.itens.map((c) => c.chave);
                  const marcadasLoja = chavesLoja.filter((k) =>
                    selecionadas.has(k),
                  ).length;
                  return (
                    <div
                      key={grupoLoja.loja}
                      className="space-y-2 rounded-md border border-slate-100 bg-slate-50 p-2"
                    >
                      <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                        <CheckboxDeGrupo
                          checked={marcadasLoja === chavesLoja.length}
                          indeterminado={
                            marcadasLoja > 0 && marcadasLoja < chavesLoja.length
                          }
                          onChange={() =>
                            toggleGrupo(chavesLoja, marcadasLoja !== chavesLoja.length)
                          }
                        />
                        {grupoLoja.loja}
                        <span className="font-normal text-slate-400">
                          ({marcadasLoja}/{chavesLoja.length})
                        </span>
                      </label>

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
                            selecionavel
                            selecionada={selecionadas.has(compra.chave)}
                            onToggle={() => toggle(compra.chave)}
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
    </section>
  );
}
