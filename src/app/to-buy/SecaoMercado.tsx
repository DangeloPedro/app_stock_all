"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoeda } from "@/lib/moeda";
import { useMoeda } from "@/components/MoedaContext";
import { ItemLista } from "./ItemLista";

export type ItemToBuy = {
  id: string;
  nome: string;
  quantidadePadrao: number | null;
  lojaPreferidaId: string | null;
  pegoNoMercado: boolean;
  precoEstimado: number | null;
};

type CampoCarrinho = { precoPago: string; quantidade: string };

// Preço pago (total) começa preenchido com o preço de referência já
// conhecido pra esse mercado × quantidade padrão — o usuário ajusta se
// pagou diferente. Sem referência conhecida, fica em branco (obrigatório
// preencher à mão).
function precoPadrao(item: ItemToBuy) {
  if (item.precoEstimado === null) return "";
  const total = item.precoEstimado * (item.quantidadePadrao ?? 1);
  return String(Math.round(total * 100) / 100);
}

function quantidadePadraoStr(item: ItemToBuy) {
  return String(item.quantidadePadrao ?? 1);
}

// Uma seção = um mercado (já agrupado pela página). Dono do "carrinho" da
// visita: quais itens foram marcados como pegos + o preço/quantidade que
// vão pro EventoDeCompra quando confirmar. Só o check em si (pegoNoMercado)
// é persistido no produto — preço/quantidade em edição aqui são só da
// sessão, recalculados a partir do padrão sempre que o carrinho é
// (re)montado ou um item é marcado.
export function SecaoMercado({
  loja,
  itens,
  subtotal,
  confirmavel,
}: {
  loja: string;
  itens: ItemToBuy[];
  subtotal: number;
  // false só pro grupo "Sem mercado definido" — sem loja atribuída não dá
  // pra registrar EventoDeCompra, então nem marcar como pego faz sentido
  // ali (força atribuir mercado primeiro).
  confirmavel: boolean;
}) {
  const router = useRouter();
  const moeda = useMoeda();
  const itensPorId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);

  const [carrinho, setCarrinho] = useState<Record<string, CampoCarrinho>>(() =>
    Object.fromEntries(
      itens
        .filter((i) => i.pegoNoMercado)
        .map((i) => [
          i.id,
          { precoPago: precoPadrao(i), quantidade: quantidadePadraoStr(i) },
        ]),
    ),
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alternarCheck(produtoId: string, marcado: boolean) {
    const item = itensPorId.get(produtoId);
    setCarrinho((prev) => {
      if (!marcado) {
        const { [produtoId]: _removido, ...resto } = prev;
        return resto;
      }
      return {
        ...prev,
        [produtoId]: {
          precoPago: precoPadrao(item!),
          quantidade: quantidadePadraoStr(item!),
        },
      };
    });
    await fetch(`/api/produtos/${produtoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pegoNoMercado: marcado }),
    });
    router.refresh();
  }

  function mudarCampo(
    produtoId: string,
    campo: keyof CampoCarrinho,
    valor: string,
  ) {
    setCarrinho((prev) => ({
      ...prev,
      [produtoId]: { ...prev[produtoId], [campo]: valor },
    }));
  }

  async function confirmarCompra() {
    setEnviando(true);
    setErro(null);
    const entradas = Object.entries(carrinho);
    // Mesmo id em todos os itens desta confirmação — é o que permite
    // /historico separar duas compras na mesma loja no mesmo dia.
    const grupoCompraId = crypto.randomUUID();

    const resultados = await Promise.allSettled(
      entradas.map(async ([produtoId, valores]) => {
        const item = itensPorId.get(produtoId);
        if (!item?.lojaPreferidaId) throw new Error(item?.nome);
        const res = await fetch("/api/eventos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            produtoId,
            lojaId: item.lojaPreferidaId,
            precoPago: Number(valores.precoPago),
            quantidadeComprada: Number(valores.quantidade),
            grupoCompraId,
          }),
        });
        if (!res.ok) throw new Error(item.nome);
      }),
    );

    const falhas = resultados.filter((r) => r.status === "rejected").length;
    setErro(
      falhas > 0
        ? `${falhas} item${falhas === 1 ? "" : "s"} could not be confirmed (check the price) — the rest went to the log normally.`
        : null,
    );

    // Só tira do carrinho quem confirmou de verdade — o que falhou continua
    // marcado e editável pra tentar de novo.
    setCarrinho((prev) => {
      const proximo = { ...prev };
      entradas.forEach(([produtoId], i) => {
        if (resultados[i].status === "fulfilled") delete proximo[produtoId];
      });
      return proximo;
    });

    router.refresh();
    setEnviando(false);
  }

  const itensSelecionados = Object.keys(carrinho)
    .map((id) => itensPorId.get(id))
    .filter((i): i is ItemToBuy => i !== undefined);
  const selecionados = itensSelecionados.length;
  const totalSelecionado = Object.values(carrinho).reduce((acc, v) => {
    const n = Number(v.precoPago);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
  // Variação só faz sentido de mostrar quando TODO item marcado tem preço
  // de referência conhecido — comparar contra uma estimativa parcial
  // enganaria mais do que ajudaria.
  const todosComEstimativa =
    selecionados > 0 && itensSelecionados.every((i) => i.precoEstimado !== null);
  const estimativaSelecionada = itensSelecionados.reduce(
    (acc, i) => acc + (i.precoEstimado ?? 0) * (i.quantidadePadrao ?? 1),
    0,
  );
  const variacao = totalSelecionado - estimativaSelecionada;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {loja}
        </h2>
        {confirmavel && (
          <span className="text-xs font-medium tabular-nums text-slate-500">
            {formatMoeda(subtotal, moeda)}
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {itens.map((item) => (
          <ItemLista
            key={item.id}
            produto={item}
            emCarrinho={item.id in carrinho}
            precoPago={carrinho[item.id]?.precoPago ?? ""}
            quantidade={carrinho[item.id]?.quantidade ?? ""}
            podeMarcar={confirmavel}
            onToggle={(marcado) => alternarCheck(item.id, marcado)}
            onChangePreco={(v) => mudarCampo(item.id, "precoPago", v)}
            onChangeQuantidade={(v) => mudarCampo(item.id, "quantidade", v)}
          />
        ))}
      </ul>

      {confirmavel && (
        // sticky (não fixed) — gruda no topo da viewport só enquanto essa
        // seção ainda tá visível na rolagem; ao passar pra próxima seção,
        // solta sozinha e a próxima barra assume. Evita múltiplas barras
        // fixas disputando o mesmo espaço quando há vários mercados na
        // página, sem abrir mão de um botão por seção (decisão do usuário).
        <div className="sticky bottom-24 z-10 -mx-3 mt-2 border-t border-slate-100 bg-white/95 px-3 py-2 backdrop-blur sm:bottom-2">
          <button
            type="button"
            onClick={confirmarCompra}
            disabled={enviando || selecionados === 0}
            className="min-h-12 w-full rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50"
          >
            {enviando
              ? "confirming…"
              : selecionados === 0
                ? "confirm purchase"
                : `confirm purchase (${selecionados} · ${formatMoeda(totalSelecionado, moeda)}${
                    todosComEstimativa && Math.abs(variacao) >= 0.01
                      ? ` · ${variacao > 0 ? "+" : ""}${formatMoeda(variacao, moeda)} vs estimate`
                      : ""
                  })`}
          </button>
          {erro && (
            <p role="status" className="mt-1 text-xs text-red-600">
              {erro}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
