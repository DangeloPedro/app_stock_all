"use client";

import { useState } from "react";
import { formatMoeda, type Moeda } from "@/lib/moeda";
import type { CompraExport } from "./ExportHistorico";

function formatData(iso: string) {
  // en-GB dá DD/MM/YYYY — mesma convenção usada em toda a página de
  // histórico (ver ExportHistorico.tsx e HistoricoClient.tsx).
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// yyyy-mm-dd (formato exigido por <input type="date">), lido a partir do
// fuso local do browser — mesma convenção usada em HistoricoClient.formatISO
// pra montar dataISO, então o valor aparece no input igual ao que já é
// exibido por formatData acima.
function paraInputDate(iso: string) {
  const d = new Date(iso);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Um cartão de compra (dia + mercado, itens dentro) — usado tanto na
// navegação normal (sem checkbox) quanto dentro do painel de export (com
// checkbox), pra não duplicar a formatação nos dois lugares.
export function CompraItem({
  compra,
  moeda,
  titulo,
  selecionavel = false,
  selecionada = false,
  onToggle,
  onExcluida,
  onDataAlterada,
}: {
  compra: CompraExport;
  moeda: Moeda;
  // Sobrescreve o título padrão ("data · loja") — usado quando o item
  // aparece aninhado dentro de um grupo dia→loja que já mostra data e
  // loja nos cabeçalhos acima, e há mais de uma compra ali (ex: "purchase
  // 1", "purchase 2") pra distinguir sem repetir dado redundante.
  titulo?: string;
  selecionavel?: boolean;
  selecionada?: boolean;
  onToggle?: () => void;
  // Ausente dentro do painel de export (lá não faz sentido excluir).
  onExcluida?: () => void;
  // Presente tanto no log normal quanto no painel de export — editar a data
  // aqui muda a data real de todos os eventos da compra, refletindo nos dois
  // lugares (e no CSV exportado) assim que o pai recarrega os dados.
  onDataAlterada?: () => void;
}) {
  const [excluindo, setExcluindo] = useState(false);
  const [editandoData, setEditandoData] = useState(false);
  const [salvandoData, setSalvandoData] = useState(false);

  async function salvarData(novaData: string) {
    setSalvandoData(true);
    try {
      const res = await fetch("/api/eventos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: compra.itens.map((item) => item.id),
          data: `${novaData}T00:00:00`,
        }),
      });
      if (!res.ok) throw new Error("failed to update date");
      setEditandoData(false);
      onDataAlterada?.();
    } catch {
      window.alert("couldn't update the date, try again");
    } finally {
      setSalvandoData(false);
    }
  }

  async function excluir() {
    if (
      !window.confirm(
        `Delete this purchase (${titulo ? `${titulo} · ` : ""}${formatData(compra.dataISO)} · ${compra.loja})? It's removed from the log and totals, and the stock it added gets subtracted back. This can't be undone.`,
      )
    ) {
      return;
    }
    setExcluindo(true);
    try {
      const res = await fetch("/api/eventos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: compra.itens.map((item) => item.id) }),
      });
      if (!res.ok) throw new Error("failed to delete");
      onExcluida?.();
    } catch {
      window.alert("couldn't delete, try again");
      setExcluindo(false);
    }
  }

  return (
    <details className="rounded-lg border border-slate-200 bg-white p-3">
      <summary className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        {selecionavel && (
          <input
            type="checkbox"
            checked={selecionada}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="h-5 w-5 shrink-0 accent-blue-600"
          />
        )}
        <span className="flex-1 font-medium text-slate-900">
          {titulo ?? `${formatData(compra.dataISO)} · ${compra.loja}`}
        </span>
        <span className="font-semibold tabular-nums text-slate-900">
          {formatMoeda(compra.total, moeda)}
        </span>
      </summary>
      <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
        {compra.itens.map((item) => (
          <li
            key={item.id}
            className="flex justify-between text-sm text-slate-600"
          >
            <span>
              {item.produtoNome}{" "}
              <span className="text-slate-400">× {item.quantidadeComprada}</span>
            </span>
            <span className="tabular-nums">
              {formatMoeda(item.precoPago, moeda)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
        <span className="text-slate-400">purchase date</span>
        {editandoData ? (
          <input
            type="date"
            autoFocus
            defaultValue={paraInputDate(compra.dataISO)}
            disabled={salvandoData}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              if (e.target.value) salvarData(e.target.value);
            }}
            onBlur={() => setEditandoData(false)}
            className="min-h-8 rounded-md border border-slate-300 px-2 text-xs text-slate-700 disabled:opacity-50"
          />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setEditandoData(true);
            }}
            className="min-h-8 rounded-md px-2 font-medium text-slate-700 underline decoration-dotted decoration-slate-400 underline-offset-2 hover:bg-slate-50 hover:text-blue-600"
          >
            {formatData(compra.dataISO)}
          </button>
        )}
      </div>
      {onExcluida && (
        <button
          type="button"
          disabled={excluindo}
          onClick={(e) => {
            e.preventDefault();
            excluir();
          }}
          className="mt-2 min-h-9 w-full rounded-md border-t border-slate-100 pt-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {excluindo ? "deleting…" : "delete purchase"}
        </button>
      )}
    </details>
  );
}
