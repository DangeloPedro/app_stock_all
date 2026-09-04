"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { LojaSelect } from "@/components/LojaSelect";
import { BuscaProduto, type ProdutoBusca } from "@/components/BuscaProduto";
import { formatMoeda } from "@/lib/moeda";
import { useMoeda } from "@/components/MoedaContext";
import { reconhecerTextoDaNota } from "@/lib/receiptOcr";
import { extrairLinhasDaNota, type LinhaNota } from "@/lib/receiptParsing";
import {
  associarNotaAosProdutos,
  preAquecerModeloDeMatching,
  type ProdutoParaMatch,
} from "@/lib/receiptMatching";

type ProdutoNaLista = ProdutoParaMatch & { quantidadePadrao: number | null };

// incluido é independente de linhaId de propósito: linkar uma linha só
// pré-preenche preço/estado inicial, mas quem decide se aquele item entra
// como EventoDeCompra nesta compra é o checkbox — mesmo modelo mental do
// carrinho em SecaoMercado.tsx, pra não introduzir um comportamento novo
// só pra essa tela.
type ItemReview = {
  produto: ProdutoNaLista;
  linhaId: string | null;
  incluido: boolean;
  precoPago: string;
  quantidade: string;
  autoMatched: boolean;
  // Match automático com score abaixo do limiar de confiança — ainda vira
  // um palpite pré-preenchido (é o que foi pedido: sempre adivinhar, e
  // deixar a correção manual só pro que estiver errado), mas marcado pra
  // chamar atenção na revisão.
  baixaConfianca: boolean;
};

type Etapa = "upload" | "processando" | "revisao" | "confirmado";

export function ScanReceiptClient() {
  const router = useRouter();
  const moeda = useMoeda();

  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [statusProcessamento, setStatusProcessamento] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const [linhas, setLinhas] = useState<LinhaNota[]>([]);
  const [textoOcrBruto, setTextoOcrBruto] = useState("");
  const [itens, setItens] = useState<ItemReview[]>([]);
  const [lojaId, setLojaId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);
  const [adicionandoItem, setAdicionandoItem] = useState(false);
  const [adicionandoProduto, setAdicionandoProduto] = useState(false);

  // Pré-aquece o modelo de matching assim que a tela abre — sobrepõe o
  // download (só na primeira vez; o navegador cacheia depois disso) com o
  // tempo que o usuário leva pra escolher/tirar a foto, em vez de fazer
  // esperar depois do OCR.
  useEffect(() => {
    preAquecerModeloDeMatching().catch(() => {});
  }, []);

  async function processarFoto(arquivo: File) {
    setErro(null);
    setEtapa("processando");
    try {
      setStatusProcessamento("reading receipt…");
      const [textoOcr, resProdutos] = await Promise.all([
        reconhecerTextoDaNota(arquivo, (fracao) =>
          setStatusProcessamento(
            `reading receipt… ${Math.round(fracao * 100)}%`,
          ),
        ),
        fetch("/api/produtos?status=na_lista&ativo=true"),
      ]);
      if (!resProdutos.ok) throw new Error("couldn't load your shopping list");
      type ProdutoApi = {
        id: string;
        nome: string;
        productFamily: string;
        quantidadePadrao: number | null;
        lojaPreferidaId: string | null;
      };
      // Só casa a nota contra itens preferidos NESSA loja — sem isso, um
      // item do Tesco podia "roubar" o match de uma linha da nota do Lidl
      // (e vice-versa) só por ter texto parecido, mesmo os dois nunca
      // sendo comprados no mesmo mercado.
      const produtos: ProdutoNaLista[] = (
        (await resProdutos.json()) as ProdutoApi[]
      )
        .filter((p) => p.lojaPreferidaId === lojaId)
        .map((p) => ({
          id: p.id,
          nome: p.nome,
          productFamily: p.productFamily,
          quantidadePadrao: p.quantidadePadrao,
        }));

      setTextoOcrBruto(textoOcr);
      const linhasExtraidas = extrairLinhasDaNota(textoOcr);
      setLinhas(linhasExtraidas);

      setStatusProcessamento("matching items…");
      const matches =
        produtos.length > 0 && linhasExtraidas.length > 0
          ? await associarNotaAosProdutos(linhasExtraidas, produtos)
          : [];
      const matchPorProduto = new Map(matches.map((m) => [m.produtoId, m]));
      const linhaPorId = new Map(linhasExtraidas.map((l) => [l.id, l]));

      setItens(
        produtos.map((produto) => {
          const match = matchPorProduto.get(produto.id);
          const linhaId = match?.linhaId ?? null;
          const linha = linhaId ? linhaPorId.get(linhaId) : undefined;
          return {
            produto,
            linhaId,
            incluido: linhaId !== null,
            precoPago: linha?.precoLido != null ? String(linha.precoLido) : "",
            quantidade: String(produto.quantidadePadrao ?? 1),
            autoMatched: linhaId !== null,
            baixaConfianca: linhaId !== null && !match!.confiavel,
          };
        }),
      );
      setEtapa("revisao");
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "something went wrong reading the receipt",
      );
      setEtapa("upload");
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (arquivo) processarFoto(arquivo);
  }

  const linhasUsadas = useMemo(
    () =>
      new Set(
        itens.map((i) => i.linhaId).filter((id): id is string => id !== null),
      ),
    [itens],
  );

  function atualizarItem(produtoId: string, patch: Partial<ItemReview>) {
    setItens((prev) =>
      prev.map((i) => (i.produto.id === produtoId ? { ...i, ...patch } : i)),
    );
  }

  function ligarLinha(produtoId: string, linhaId: string) {
    const linha = linhas.find((l) => l.id === linhaId);
    atualizarItem(produtoId, {
      linhaId: linhaId || null,
      incluido: linhaId !== "",
      precoPago: linha?.precoLido != null ? String(linha.precoLido) : "",
      // escolha manual — não é mais um palpite, some o aviso de conferir
      baixaConfianca: false,
    });
  }

  // Itens já na revisão não podem reaparecer na busca — nem os que vieram
  // pré-carregados (status na_lista + loja preferida), nem um que já foi
  // adicionado por aqui.
  const idsNaRevisao = useMemo(
    () => new Set(itens.map((i) => i.produto.id)),
    [itens],
  );

  // Chamado pela BuscaProduto quando o usuário escolhe, ali mesmo na
  // revisão, um produto do catálogo (market-shelf) que a lista
  // pré-carregada não trouxe — porque não está em na_lista, ou tem loja
  // preferida diferente da loja desta nota. Depois de escolhido, roda o
  // mesmo matching semântico contra as linhas da nota ainda não usadas por
  // nenhum outro item — é o "adivinha qual produto da nota é" pedido, só
  // que de 1 produto contra N linhas em vez de N contra N.
  async function adicionarProdutoExistente(produto: ProdutoBusca) {
    setAdicionandoItem(false);
    setAdicionandoProduto(true);
    try {
      const linhasDisponiveis = linhas.filter((l) => !linhasUsadas.has(l.id));
      const matches =
        linhasDisponiveis.length > 0
          ? await associarNotaAosProdutos(linhasDisponiveis, [
              {
                id: produto.id,
                nome: produto.nome,
                productFamily: produto.productFamily,
              },
            ])
          : [];
      const match = matches[0];
      const linha = match ? linhas.find((l) => l.id === match.linhaId) : undefined;
      setItens((prev) => [
        ...prev,
        {
          produto,
          linhaId: match?.linhaId ?? null,
          // Adicionado explicitamente pelo usuário pensando nesta compra —
          // diferente do resto da lista, que só nasce marcado quando casa
          // com uma linha da nota.
          incluido: true,
          precoPago: linha?.precoLido != null ? String(linha.precoLido) : "",
          quantidade: String(produto.quantidadePadrao ?? 1),
          autoMatched: match !== undefined,
          baixaConfianca: match !== undefined && !match.confiavel,
        },
      ]);
    } finally {
      setAdicionandoProduto(false);
    }
  }

  const encontrados = itens.filter((i) => i.linhaId !== null).length;
  const linhasNaoLigadas = linhas.filter((l) => !linhasUsadas.has(l.id));

  const itensIncluidos = itens.filter((i) => i.incluido);
  const totalIncluido = itensIncluidos.reduce((acc, i) => {
    const n = Number(i.precoPago);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
  const podeConfirmar =
    lojaId !== "" &&
    itensIncluidos.length > 0 &&
    itensIncluidos.every(
      (i) => Number(i.precoPago) > 0 && Number(i.quantidade) > 0,
    );

  async function confirmarCompra() {
    setEnviando(true);
    setErroConfirmacao(null);
    // Mesmo id em todos os itens desta confirmação — é o que permite
    // /historico separar duas compras na mesma loja no mesmo dia.
    const grupoCompraId = crypto.randomUUID();
    const resultados = await Promise.allSettled(
      itensIncluidos.map(async (item) => {
        const res = await fetch("/api/eventos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            produtoId: item.produto.id,
            lojaId,
            precoPago: Number(item.precoPago),
            quantidadeComprada: Number(item.quantidade),
            grupoCompraId,
          }),
        });
        if (!res.ok) throw new Error(item.produto.nome);
      }),
    );
    const falhas = resultados.filter((r) => r.status === "rejected").length;
    if (falhas > 0) {
      setErroConfirmacao(
        `${falhas} item${falhas === 1 ? "" : "s"} could not be confirmed — check the price and try again.`,
      );
      setEnviando(false);
      return;
    }
    setEtapa("confirmado");
    setEnviando(false);
    router.refresh();
  }

  if (etapa === "upload") {
    return (
      <div className="space-y-3">
        <label className="block text-xs font-medium text-slate-600">
          store this receipt is from
          <LojaSelect value={lojaId} onChange={setLojaId} />
        </label>
        <p className="text-xs text-slate-400">
          only list items you buy at this store will be matched against the
          receipt.
        </p>
        <label
          className={`flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center ${
            lojaId
              ? "cursor-pointer border-slate-300 hover:border-blue-400"
              : "cursor-not-allowed border-slate-200 opacity-50"
          }`}
        >
          <span className="text-sm font-medium text-slate-700">
            tap to upload a receipt photo
          </span>
          <span className="text-xs text-slate-400">
            jpg, png — from camera or gallery
          </span>
          <input
            type="file"
            accept="image/*"
            // Sem `capture` de propósito: com ele, mobile abre a câmera
            // direto e não oferece escolher uma foto já salva na galeria
            // (bug reportado pelo usuário). Sem o atributo, o próprio
            // navegador mostra as duas opções (câmera ou galeria).
            className="sr-only"
            disabled={!lojaId}
            onChange={onFileChange}
          />
        </label>
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
          purchase confirmed — {itensIncluidos.length} item
          {itensIncluidos.length === 1 ? "" : "s"} added to the log.
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
      <p className="text-sm text-slate-600">
        <span className="font-semibold tabular-nums text-slate-900">
          {encontrados}
        </span>
        {" / "}
        <span className="tabular-nums">{itens.length}</span> list items found
        on the receipt
      </p>

      <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span>only showing items you buy at the store you picked</span>
        <button
          type="button"
          onClick={() => setEtapa("upload")}
          className="shrink-0 font-medium text-blue-600 hover:text-blue-700"
        >
          wrong store? start over
        </button>
      </div>

      {itens.length === 0 && (
        <p className="text-sm text-amber-700">
          no list items are set to be bought at this store yet — set
          &quot;preferred store&quot; on the items you want to match against
          this receipt (in to-buy), then scan again.
        </p>
      )}

      <ul className="space-y-2">
        {itens.map((item) => {
          const opcoesLinha = linhas.filter(
            (l) => l.id === item.linhaId || !linhasUsadas.has(l.id),
          );
          return (
            <li
              key={item.produto.id}
              className={`rounded-lg border p-3 ${
                item.incluido && item.baixaConfianca
                  ? "border-amber-300 bg-amber-50/50"
                  : item.incluido
                    ? "border-emerald-300 bg-emerald-50/50"
                    : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-2">
                <label className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={item.incluido}
                    onChange={(e) =>
                      atualizarItem(item.produto.id, {
                        incluido: e.target.checked,
                      })
                    }
                    className="h-6 w-6 accent-emerald-600"
                  />
                </label>
                <div className="min-w-0 flex-1 pt-1.5">
                  <p className="text-base font-semibold text-slate-900">
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
                </div>
              </div>

              <div className="ml-9 mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="text-xs font-medium text-slate-600">
                  receipt line
                  <select
                    value={item.linhaId ?? ""}
                    onChange={(e) => ligarLinha(item.produto.id, e.target.value)}
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
                <label className="text-xs font-medium text-slate-600">
                  price paid (total)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.precoPago}
                    onChange={(e) =>
                      atualizarItem(item.produto.id, {
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
                      atualizarItem(item.produto.id, {
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

      <div>
        {adicionandoItem ? (
          <BuscaProduto
            onEscolher={adicionarProdutoExistente}
            excluirIds={idsNaRevisao}
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdicionandoItem(true)}
            className="min-h-11 w-full rounded-md border border-dashed border-slate-300 text-sm font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600"
          >
            + add an item not on your list
          </button>
        )}
        {adicionandoProduto && (
          <p className="mt-1 text-xs text-slate-400">
            matching it against the receipt…
          </p>
        )}
      </div>

      {linhasNaoLigadas.length > 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-3">
          <p className="text-xs font-medium text-slate-500">
            other lines read from the receipt (not linked to any list item):
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

      <details className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
        <summary className="cursor-pointer font-medium text-slate-600">
          raw OCR text (debug — what Tesseract actually read)
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-[11px] text-slate-600">
          {textoOcrBruto || "(empty)"}
        </pre>
      </details>

      <div className="sticky bottom-24 z-10 -mx-3 border-t border-slate-100 bg-white/95 px-3 py-2 backdrop-blur sm:bottom-2">
        <button
          type="button"
          onClick={confirmarCompra}
          disabled={!podeConfirmar || enviando}
          className="min-h-12 w-full rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50"
        >
          {enviando
            ? "confirming…"
            : `confirm purchase (${itensIncluidos.length} · ${formatMoeda(totalIncluido, moeda)})`}
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
