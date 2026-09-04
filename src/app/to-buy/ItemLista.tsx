"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LojaSelect } from "@/components/LojaSelect";
import { PrecosPorLoja } from "@/components/PrecosPorLoja";
import { formatMoeda } from "@/lib/moeda";
import { useMoeda } from "@/components/MoedaContext";
import type { ItemToBuy } from "./SecaoMercado";

export function ItemLista({
  produto,
  emCarrinho,
  precoPago,
  quantidade,
  podeMarcar,
  onToggle,
  onChangePreco,
  onChangeQuantidade,
}: {
  produto: ItemToBuy;
  // Controlado pela SecaoMercado (mãe) — ela é quem sabe o carrinho da
  // visita inteira, necessário pro botão "Confirmar compra" da seção.
  emCarrinho: boolean;
  precoPago: string;
  quantidade: string;
  podeMarcar: boolean;
  onToggle: (marcado: boolean) => void;
  onChangePreco: (valor: string) => void;
  onChangeQuantidade: (valor: string) => void;
}) {
  const router = useRouter();
  const moeda = useMoeda();
  const [mercadoAtribuido, setMercadoAtribuido] = useState(
    produto.lojaPreferidaId ?? "",
  );
  // Aberto por padrão só quando ainda não tem mercado atribuído (precisa
  // atribuir antes de conseguir marcar) — do contrário fica escondido,
  // fora do caminho de quem só tá escaneando a lista no mercado.
  const [planejamentoAberto, setPlanejamentoAberto] = useState(
    !produto.lojaPreferidaId,
  );
  const [salvandoMercado, setSalvandoMercado] = useState(false);
  const [erroMercado, setErroMercado] = useState(false);
  const [desistindo, setDesistindo] = useState(false);

  const quantidadeNumero = produto.quantidadePadrao ?? 1;

  async function atribuirMercado(novoLojaId: string) {
    setMercadoAtribuido(novoLojaId);
    setSalvandoMercado(true);
    setErroMercado(false);
    try {
      const res = await fetch(`/api/produtos/${produto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lojaPreferidaId: novoLojaId || null }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setErroMercado(true);
    } finally {
      setSalvandoMercado(false);
    }
  }

  // "Desistir" = tira da lista de compras sem registrar compra nenhuma.
  // Volta pro estado market (catalogado) e zera o estoque — item não tá em
  // casa nem tá mais planejado, então nenhum dos dois deveria ficar
  // implícito com um valor antigo.
  async function desistir() {
    setDesistindo(true);
    try {
      const res = await fetch(`/api/produtos/${produto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "catalogado",
          quantidadeEmEstoque: 0,
          pegoNoMercado: false,
        }),
      });
      if (res.ok) router.refresh();
    } finally {
      setDesistindo(false);
    }
  }

  return (
    <li
      className={`rounded-lg border p-3 transition-colors ${
        emCarrinho
          ? "border-emerald-300 bg-emerald-50/50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-2">
        <label className="-m-2.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={emCarrinho}
            disabled={!podeMarcar}
            title={
              podeMarcar ? undefined : 'assign a store in "plan/edit" first'
            }
            onChange={(e) => onToggle(e.target.checked)}
            className="h-6 w-6 shrink-0 accent-emerald-600 disabled:opacity-40"
          />
        </label>
        <div className="min-w-0 flex-1 pt-1.5">
          <p className="text-base font-semibold text-slate-900">
            {produto.nome}
          </p>
          <p className="text-sm tabular-nums text-slate-500">
            × {quantidadeNumero}
            {produto.precoEstimado !== null && (
              <>
                {" "}
                · ~
                {formatMoeda(produto.precoEstimado * quantidadeNumero, moeda)}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          disabled={desistindo}
          onClick={desistir}
          className="min-h-11 shrink-0 px-2 py-2.5 text-xs text-slate-400 hover:text-slate-600 active:text-slate-700"
        >
          drop
        </button>
      </div>

      <button
        type="button"
        onClick={() => setPlanejamentoAberto((v) => !v)}
        className="ml-9 mt-1 min-h-9 px-2 text-xs font-medium text-blue-600 hover:text-blue-700 active:text-blue-800"
      >
        {planejamentoAberto
          ? "hide plan"
          : mercadoAtribuido
            ? "plan/edit"
            : "assign a store"}
      </button>

      {planejamentoAberto && (
        <div className="ml-9 mt-1 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            buy at:
            <LojaSelect
              value={mercadoAtribuido}
              onChange={atribuirMercado}
              className="min-h-11 rounded-md border border-slate-300 px-2 text-base sm:min-h-9 sm:text-sm"
              permitirVazio
            />
          </label>
          {salvandoMercado && (
            <span role="status" className="text-xs text-slate-400">
              saving…
            </span>
          )}
          {erroMercado && (
            <span role="status" className="text-xs text-red-600">
              couldn&apos;t save, try again
            </span>
          )}
          <PrecosPorLoja produtoId={produto.id} />
        </div>
      )}

      {emCarrinho && (
        <div className="ml-9 mt-3 grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-600">
            price paid (total)
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={precoPago}
              onChange={(e) => onChangePreco(e.target.value)}
              placeholder="0.00"
              className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-2 text-base sm:min-h-9 sm:text-sm"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            quantity
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={quantidade}
              onChange={(e) => onChangeQuantidade(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-2 text-base sm:min-h-9 sm:text-sm"
            />
          </label>
        </div>
      )}
    </li>
  );
}
