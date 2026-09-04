"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { LojaSelect } from "@/components/LojaSelect";
import { formatMoeda } from "@/lib/moeda";
import { useMoeda } from "@/components/MoedaContext";
import { reconhecerTextoDaNota } from "@/lib/receiptOcr";
import { extrairLinhasDaNota, type LinhaNota } from "@/lib/receiptParsing";
import {
  associarNotaAosProdutos,
  preAquecerModeloDeMatching,
} from "@/lib/receiptMatching";
import { BuscaProduto, type ProdutoBusca } from "@/components/BuscaProduto";

// Item já escolhido pelo usuário na etapa "montar" — diferente do fluxo de
// scan (que parte de TODA a lista pra combinar), aqui é sempre uma lista
// curta e deliberada (o usuário buscou e clicou em cada um).
type ItemAteFora = {
  produto: ProdutoBusca;
  quantidade: string;
};

type ItemReview = ItemAteFora & {
  linhaId: string | null;
  precoPago: string;
  autoMatched: boolean;
  baixaConfianca: boolean;
};

type Etapa = "montar" | "processando" | "revisao" | "confirmado";

export function AteForaClient() {
  const router = useRouter();
  const moeda = useMoeda();

  const [etapa, setEtapa] = useState<Etapa>("montar");
  const [statusProcessamento, setStatusProcessamento] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const [lojaId, setLojaId] = useState("");
  const [itensMontagem, setItensMontagem] = useState<ItemAteFora[]>([]);
  const [adicionando, setAdicionando] = useState(true);

  const [linhas, setLinhas] = useState<LinhaNota[]>([]);
  const [textoOcrBruto, setTextoOcrBruto] = useState("");
  const [itensRevisao, setItensRevisao] = useState<ItemReview[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);

  // Mesmo raciocínio do scan: sobrepõe o download do modelo de matching com
  // o tempo que o usuário leva pra montar a lista de itens, só útil se ele
  // de fato anexar uma nota.
  useEffect(() => {
    preAquecerModeloDeMatching().catch(() => {});
  }, []);

  const idsJaAdicionados = useMemo(
    () => new Set(itensMontagem.map((i) => i.produto.id)),
    [itensMontagem],
  );

  function adicionarProduto(produto: ProdutoBusca) {
    setItensMontagem((prev) => [...prev, { produto, quantidade: "1" }]);
    setAdicionando(false);
  }

  function removerDaMontagem(produtoId: string) {
    setItensMontagem((prev) => prev.filter((i) => i.produto.id !== produtoId));
  }

  function mudarQuantidadeMontagem(produtoId: string, quantidade: string) {
    setItensMontagem((prev) =>
      prev.map((i) => (i.produto.id === produtoId ? { ...i, quantidade } : i)),
    );
  }

  function irParaRevisao(
    matches: { produtoId: string; linhaId: string; confiavel: boolean }[],
    // Recebe as linhas como parâmetro em vez de ler do estado `linhas`:
    // essa função é chamada logo depois de um setLinhas(...) na mesma
    // execução, e o React só reflete esse valor no próximo render — ler o
    // estado aqui pegaria o array antigo (bug real: produto casava certo
    // mas preço não vinha, porque o lookup batia em vazio).
    linhasParaUsar: LinhaNota[],
    // Preço de referência (por unidade) por produto, só usado quando não há
    // linha de nota casada — caso do "continuar sem nota", onde o preço
    // default vem do preço salvo (referência ou último pago), nunca em
    // branco pra digitar do zero. Continua editável depois.
    precoReferenciaPorProduto: Map<string, number | null> = new Map(),
  ) {
    const matchPorProduto = new Map(matches.map((m) => [m.produtoId, m]));
    const linhaPorId = new Map(linhasParaUsar.map((l) => [l.id, l]));
    setItensRevisao(
      itensMontagem.map((item) => {
        const match = matchPorProduto.get(item.produto.id);
        const linhaId = match?.linhaId ?? null;
        const linha = linhaId ? linhaPorId.get(linhaId) : undefined;
        const precoReferencia = precoReferenciaPorProduto.get(item.produto.id);
        const quantidade = Number(item.quantidade) || 1;
        return {
          ...item,
          linhaId,
          precoPago:
            linha?.precoLido != null
              ? String(linha.precoLido)
              : precoReferencia != null
                ? String(Math.round(precoReferencia * quantidade * 100) / 100)
                : "",
          autoMatched: linhaId !== null,
          baixaConfianca: linhaId !== null && !match!.confiavel,
        };
      }),
    );
    setEtapa("revisao");
  }

  async function processarNota(arquivo: File) {
    setErro(null);
    setEtapa("processando");
    try {
      setStatusProcessamento("reading receipt…");
      const textoOcr = await reconhecerTextoDaNota(arquivo, (fracao) =>
        setStatusProcessamento(`reading receipt… ${Math.round(fracao * 100)}%`),
      );
      setTextoOcrBruto(textoOcr);
      const linhasExtraidas = extrairLinhasDaNota(textoOcr);
      setLinhas(linhasExtraidas);

      setStatusProcessamento("matching items…");
      const produtosParaMatch = itensMontagem.map((i) => i.produto);
      const matches =
        linhasExtraidas.length > 0
          ? await associarNotaAosProdutos(linhasExtraidas, produtosParaMatch)
          : [];
      irParaRevisao(matches, linhasExtraidas);
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "something went wrong reading the receipt",
      );
      setEtapa("montar");
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (arquivo) processarNota(arquivo);
  }

  async function continuarSemNota() {
    setLinhas([]);
    setTextoOcrBruto("");

    // Sem nota pra ler preço nenhum: busca o preço já salvo (referência ou
    // último pago) pra cada produto nesse mercado, pra não forçar digitar
    // tudo do zero — o campo continua editável na revisão.
    const precoReferenciaPorProduto = new Map<string, number | null>();
    await Promise.all(
      itensMontagem.map(async (item) => {
        try {
          const res = await fetch(`/api/produtos/${item.produto.id}/precos`);
          if (!res.ok) return;
          const precos: { lojaId: string; preco: number | null }[] =
            await res.json();
          const preco = precos.find((p) => p.lojaId === lojaId)?.preco ?? null;
          precoReferenciaPorProduto.set(item.produto.id, preco);
        } catch {
          // sem referência disponível — fica em branco, como antes.
        }
      }),
    );

    irParaRevisao([], [], precoReferenciaPorProduto);
  }

  const podeContinuar = lojaId !== "" && itensMontagem.length > 0;

  const linhasUsadas = useMemo(
    () =>
      new Set(
        itensRevisao
          .map((i) => i.linhaId)
          .filter((id): id is string => id !== null),
      ),
    [itensRevisao],
  );
  const linhasNaoLigadas = linhas.filter((l) => !linhasUsadas.has(l.id));

  function atualizarRevisao(produtoId: string, patch: Partial<ItemReview>) {
    setItensRevisao((prev) =>
      prev.map((i) => (i.produto.id === produtoId ? { ...i, ...patch } : i)),
    );
  }

  function ligarLinha(produtoId: string, linhaId: string) {
    const linha = linhas.find((l) => l.id === linhaId);
    atualizarRevisao(produtoId, {
      linhaId: linhaId || null,
      precoPago: linha?.precoLido != null ? String(linha.precoLido) : "",
      baixaConfianca: false,
    });
  }

  function removerDaRevisao(produtoId: string) {
    setItensRevisao((prev) => prev.filter((i) => i.produto.id !== produtoId));
  }

  const totalRevisao = itensRevisao.reduce((acc, i) => {
    const n = Number(i.precoPago);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
  const podeConfirmar =
    itensRevisao.length > 0 &&
    itensRevisao.every((i) => Number(i.precoPago) > 0 && Number(i.quantidade) > 0);

  async function confirmarLog() {
    setEnviando(true);
    setErroConfirmacao(null);
    // Mesmo id em todos os itens desta confirmação — é o que permite
    // /historico separar duas compras na mesma loja no mesmo dia.
    const grupoCompraId = crypto.randomUUID();
    const resultados = await Promise.allSettled(
      itensRevisao.map(async (item) => {
        const res = await fetch("/api/eventos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            produtoId: item.produto.id,
            lojaId,
            precoPago: Number(item.precoPago),
            quantidadeComprada: Number(item.quantidade),
            // não é estoque de casa — foi comprado e comido no mercado/fora.
            afetaEstoque: false,
            grupoCompraId,
          }),
        });
        if (!res.ok) throw new Error(item.produto.nome);
      }),
    );
    const falhas = resultados.filter((r) => r.status === "rejected").length;
    if (falhas > 0) {
      setErroConfirmacao(
        `${falhas} item${falhas === 1 ? "" : "s"} could not be logged — check the price and try again.`,
      );
      setEnviando(false);
      return;
    }
    setEtapa("confirmado");
    setEnviando(false);
    router.refresh();
  }

  if (etapa === "montar") {
    return (
      <div className="space-y-3">
        <label className="block text-xs font-medium text-slate-600">
          store
          <LojaSelect value={lojaId} onChange={setLojaId} />
        </label>

        {itensMontagem.length > 0 && (
          <ul className="space-y-2">
            {itensMontagem.map((item) => (
              <li
                key={item.produto.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
              >
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                  {item.produto.nome}
                </p>
                <label className="text-xs font-medium text-slate-600">
                  qty
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.quantidade}
                    onChange={(e) =>
                      mudarQuantidadeMontagem(item.produto.id, e.target.value)
                    }
                    className="mt-1 min-h-11 w-16 rounded-md border border-slate-300 px-2 text-base sm:min-h-9 sm:text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removerDaMontagem(item.produto.id)}
                  aria-label={`remove ${item.produto.nome}`}
                  className="min-h-11 min-w-11 shrink-0 text-lg text-slate-400 hover:text-red-600"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {adicionando ? (
          <BuscaProduto
            onEscolher={adicionarProduto}
            excluirIds={idsJaAdicionados}
            autoFocus={itensMontagem.length > 0}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdicionando(true)}
            className="min-h-11 w-full rounded-md border border-dashed border-slate-300 text-sm font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600"
          >
            + add another item
          </button>
        )}

        <div className="rounded-lg border border-dashed border-slate-300 p-3">
          <p className="text-xs font-medium text-slate-600">
            optional: attach the receipt to auto-fill prices
          </p>
          <label
            className={`mt-2 flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border border-slate-200 text-center ${
              podeContinuar
                ? "cursor-pointer hover:border-blue-400"
                : "cursor-not-allowed opacity-50"
            }`}
          >
            <span className="text-xs text-slate-500">
              tap to upload a receipt photo
            </span>
            <input
              type="file"
              accept="image/*"
              // Sem `capture` de propósito — ver comentário em
              // to-buy/scan/ScanReceiptClient.tsx.
              className="sr-only"
              disabled={!podeContinuar}
              onChange={onFileChange}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={continuarSemNota}
          disabled={!podeContinuar}
          className="min-h-12 w-full rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50"
        >
          continue without receipt
        </button>

        {erro && <p className="text-sm text-red-600">{erro}</p>}
      </div>
    );
  }

  if (etapa === "processando") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm font-medium text-slate-700">
          {statusProcessamento}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          first time may take a bit longer (downloading local models —
          cached on this device after that)
        </p>
      </div>
    );
  }

  if (etapa === "confirmado") {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-6 text-center">
        <p className="text-sm font-medium text-emerald-800">
          logged — {itensRevisao.length} item
          {itensRevisao.length === 1 ? "" : "s"} added to the log (stock
          unchanged).
        </p>
        <div className="mt-3 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/to-buy")}
            className="min-h-11 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
          >
            back to to-buy
          </button>
          <button
            type="button"
            onClick={() => router.push("/historico")}
            className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            view history
          </button>
        </div>
      </div>
    );
  }

  // etapa === "revisao"
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span>confirm the price paid for each item before logging</span>
        <button
          type="button"
          onClick={() => setEtapa("montar")}
          className="shrink-0 font-medium text-blue-600 hover:text-blue-700"
        >
          ← back
        </button>
      </div>

      <ul className="space-y-2">
        {itensRevisao.map((item) => {
          const opcoesLinha = linhas.filter(
            (l) => l.id === item.linhaId || !linhasUsadas.has(l.id),
          );
          return (
            <li
              key={item.produto.id}
              className={`rounded-lg border p-3 ${
                item.baixaConfianca
                  ? "border-amber-300 bg-amber-50/50"
                  : item.autoMatched
                    ? "border-emerald-300 bg-emerald-50/50"
                    : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-base font-semibold text-slate-900">
                  {item.produto.nome}
                  {item.autoMatched && !item.baixaConfianca && (
                    <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-blue-700">
                      auto
                    </span>
                  )}
                  {item.autoMatched && item.baixaConfianca && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                      check this
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => removerDaRevisao(item.produto.id)}
                  aria-label={`remove ${item.produto.nome}`}
                  className="min-h-11 min-w-11 shrink-0 text-lg text-slate-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>

              <div
                className={`mt-2 grid grid-cols-1 gap-2 ${
                  linhas.length > 0 ? "sm:grid-cols-3" : "sm:grid-cols-2"
                }`}
              >
                {linhas.length > 0 && (
                  <label className="text-xs font-medium text-slate-600">
                    receipt line
                    <select
                      value={item.linhaId ?? ""}
                      onChange={(e) =>
                        ligarLinha(item.produto.id, e.target.value)
                      }
                      className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-2 text-base sm:min-h-9 sm:text-sm"
                    >
                      <option value="">— not on receipt —</option>
                      {opcoesLinha.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.textoOriginal}
                          {l.precoLido != null ? ` (${l.precoLido})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="text-xs font-medium text-slate-600">
                  price paid (total)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.precoPago}
                    onChange={(e) =>
                      atualizarRevisao(item.produto.id, {
                        precoPago: e.target.value,
                      })
                    }
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
                    value={item.quantidade}
                    onChange={(e) =>
                      atualizarRevisao(item.produto.id, {
                        quantidade: e.target.value,
                      })
                    }
                    className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-2 text-base sm:min-h-9 sm:text-sm"
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ul>

      {linhasNaoLigadas.length > 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-3">
          <p className="text-xs font-medium text-slate-500">
            other lines read from the receipt (not linked to any item):
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
            {linhasNaoLigadas.map((l) => (
              <li key={l.id}>
                {l.textoOriginal}
                {l.precoLido != null ? ` — ${l.precoLido}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {textoOcrBruto && (
        <details className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
          <summary className="cursor-pointer font-medium text-slate-600">
            raw OCR text (debug — what Tesseract actually read)
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-[11px] text-slate-600">
            {textoOcrBruto}
          </pre>
        </details>
      )}

      <div className="sticky bottom-24 z-10 -mx-3 border-t border-slate-100 bg-white/95 px-3 py-2 backdrop-blur sm:bottom-2">
        <button
          type="button"
          onClick={confirmarLog}
          disabled={!podeConfirmar || enviando}
          className="min-h-12 w-full rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50"
        >
          {enviando
            ? "logging…"
            : `confirm — add to log (${itensRevisao.length} · ${formatMoeda(totalRevisao, moeda)})`}
        </button>
        {erroConfirmacao && (
          <p role="status" className="mt-1 text-xs text-red-600">
            {erroConfirmacao}
          </p>
        )}
      </div>
    </div>
  );
}
