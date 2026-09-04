"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Produto,
  StatusProduto,
  Localizacao,
  EventoDeCompra,
  Loja,
} from "@prisma/client";
import { FamilyInput } from "./FamilyInput";
import { LocalizacaoSelect } from "@/components/LocalizacaoSelect";
import { EstoqueInput } from "@/components/EstoqueInput";
import { AcabouButton } from "@/components/AcabouButton";
import { PrecosPorLoja } from "@/components/PrecosPorLoja";
import { UnidadeMedidaInput } from "@/components/UnidadeMedidaInput";
import { formatMoeda } from "@/lib/moeda";
import { useMoeda } from "@/components/MoedaContext";

type ProdutoComLocalizacao = Produto & { localizacao: Localizacao | null };
type EventoComLoja = EventoDeCompra & { loja: Loja };

// Rótulos e cores mantêm os nomes originais do Notion ("market"/"shelf"),
// só o terceiro estado (na_lista) não aparece aqui — quem cuida dele é a
// aba to-buy.
const STATUS_LABEL: Record<StatusProduto, string> = {
  catalogado: "market",
  na_lista: "to buy",
  em_casa: "shelf",
};

const STATUS_STYLE: Record<StatusProduto, string> = {
  catalogado: "bg-slate-100 text-slate-700",
  na_lista: "bg-amber-100 text-amber-800",
  em_casa: "bg-emerald-100 text-emerald-800",
};

export function ProdutoCard({
  produto,
  ultimoEvento,
  mode = "catalog",
}: {
  produto: ProdutoComLocalizacao;
  ultimoEvento: EventoComLoja | null;
  // "shelf" (usado em /shelf, onde todo item já é em_casa por definição):
  // prioriza quantidade em estoque + "out" — o selo de status seria
  // redundante ali. "catalog" (default, usado em /market-shelf, que
  // mistura catalogado + em_casa): prioriza família/status/preço.
  mode?: "shelf" | "catalog";
}) {
  const router = useRouter();
  const moeda = useMoeda();
  const [editando, setEditando] = useState(false);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState(false);

  async function atualizar(data: Record<string, unknown>) {
    setSalvando(true);
    setErroSalvar(false);
    try {
      const res = await fetch(`/api/produtos/${produto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      router.refresh();
      setEditando(false);
    } catch {
      setErroSalvar(true);
    } finally {
      setSalvando(false);
    }
  }

  const infoPreco = ultimoEvento ? (
    <span className="tabular-nums">
      {formatMoeda(ultimoEvento.precoPago, moeda)}
      <span className="text-slate-400"> total</span>
      {ultimoEvento.quantidadeComprada !== 1 && (
        <span className="text-slate-400">
          {" "}
          ·{" "}
          {formatMoeda(
            ultimoEvento.precoPago / ultimoEvento.quantidadeComprada,
            moeda,
          )}
          /unit
        </span>
      )}{" "}
      <span className="text-slate-400">
        ({ultimoEvento.loja.nome}, x{ultimoEvento.quantidadeComprada})
      </span>
    </span>
  ) : (
    <span className="text-slate-400">no price history yet</span>
  );

  if (mode === "shelf") {
    return (
      <li className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base font-semibold text-slate-900">
              {produto.nome}
            </p>
          </div>
          <p className="shrink-0 text-lg font-semibold tabular-nums text-slate-900">
            × {produto.quantidadeEmEstoque}
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <EstoqueInput
            produtoId={produto.id}
            valorInicial={produto.quantidadeEmEstoque}
          />
          <AcabouButton
            produtoId={produto.id}
            quantidadePadraoAtual={produto.quantidadePadrao}
            lojaPreferidaAtual={produto.lojaPreferidaId}
          />
        </div>

        <button
          type="button"
          onClick={() => setDetalhesAbertos((v) => !v)}
          className="mt-2 min-h-9 px-1 text-xs font-medium text-blue-600 hover:text-blue-700 active:text-blue-800"
        >
          {detalhesAbertos ? "hide details" : "price & details"}
        </button>

        {detalhesAbertos && (
          <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
            <p className="text-sm text-slate-700">{infoPreco}</p>
            <div className="flex flex-wrap items-center gap-2">
              <PrecosPorLoja
                produtoId={produto.id}
                unidadeDeMedida={produto.unidadeDeMedida}
                conteudoEmbalagem={produto.conteudoEmbalagem}
              />
              <button
                type="button"
                onClick={() => setEditando((v) => !v)}
                className="min-h-9 rounded-md px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                {editando ? "close" : "edit"}
              </button>
            </div>
            {editando && (
              <EditForm
                produto={produto}
                salvando={salvando}
                erro={erroSalvar}
                onSalvar={atualizar}
              />
            )}
          </div>
        )}
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-900">
            {produto.nome}
          </p>
          <p className="text-sm text-slate-500">
            {produto.productFamily || (
              <span className="italic text-slate-400">no family</span>
            )}
          </p>
          {produto.status === "em_casa" && produto.localizacao && (
            <p className="text-xs text-slate-400">{produto.localizacao.nome}</p>
          )}
          <p className="mt-1 text-sm text-slate-700">{infoPreco}</p>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[produto.status]}`}
        >
          {STATUS_LABEL[produto.status]}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {produto.status === "catalogado" && (
          <AcabouButton
            produtoId={produto.id}
            quantidadePadraoAtual={produto.quantidadePadrao}
            lojaPreferidaAtual={produto.lojaPreferidaId}
            label="+ to buy"
          />
        )}
        {produto.status === "em_casa" && (
          <>
            <EstoqueInput
              produtoId={produto.id}
              valorInicial={produto.quantidadeEmEstoque}
            />
            <AcabouButton
              produtoId={produto.id}
              quantidadePadraoAtual={produto.quantidadePadrao}
              lojaPreferidaAtual={produto.lojaPreferidaId}
            />
          </>
        )}
        <PrecosPorLoja
          produtoId={produto.id}
          unidadeDeMedida={produto.unidadeDeMedida}
          conteudoEmbalagem={produto.conteudoEmbalagem}
        />
        <button
          type="button"
          onClick={() => setEditando((v) => !v)}
          className="min-h-9 rounded-md px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
        >
          {editando ? "close" : "edit"}
        </button>
      </div>

      {editando && (
        <EditForm
          produto={produto}
          salvando={salvando}
          erro={erroSalvar}
          onSalvar={atualizar}
        />
      )}
    </li>
  );
}

function EditForm({
  produto,
  salvando,
  erro,
  onSalvar,
}: {
  produto: ProdutoComLocalizacao;
  salvando: boolean;
  erro: boolean;
  onSalvar: (data: Record<string, unknown>) => void;
}) {
  const [nome, setNome] = useState(produto.nome);
  const [productFamily, setProductFamily] = useState(produto.productFamily);
  const [localizacaoId, setLocalizacaoId] = useState(
    produto.localizacaoId ?? "",
  );
  const [unidadeDeMedida, setUnidadeDeMedida] = useState(
    produto.unidadeDeMedida ?? "",
  );
  const [conteudoEmbalagem, setConteudoEmbalagem] = useState(
    produto.conteudoEmbalagem ? String(produto.conteudoEmbalagem) : "",
  );
  const [quantidadePadrao, setQuantidadePadrao] = useState(
    produto.quantidadePadrao ? String(produto.quantidadePadrao) : "",
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSalvar({
          nome,
          productFamily,
          localizacaoId: localizacaoId || null,
          unidadeDeMedida: unidadeDeMedida || null,
          conteudoEmbalagem: conteudoEmbalagem ? Number(conteudoEmbalagem) : null,
          quantidadePadrao: quantidadePadrao ? Number(quantidadePadrao) : null,
        });
      }}
      className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2"
    >
      <label className="col-span-1 text-xs font-medium text-slate-600 sm:col-span-2">
        name
        <input
          value={nome}
          required
          onChange={(e) => setNome(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-2 text-base sm:min-h-9 sm:text-sm"
        />
      </label>
      <label className="col-span-1 text-xs font-medium text-slate-600 sm:col-span-2">
        family
        <FamilyInput value={productFamily} onChange={setProductFamily} required />
      </label>
      <label className="text-xs font-medium text-slate-600">
        home location (shelf)
        <LocalizacaoSelect value={localizacaoId} onChange={setLocalizacaoId} />
      </label>
      <label className="text-xs font-medium text-slate-600">
        default quantity (pre-fill on to-buy)
        <input
          type="number"
          step="0.01"
          min="0"
          value={quantidadePadrao}
          onChange={(e) => setQuantidadePadrao(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-2 text-base sm:min-h-9 sm:text-sm"
        />
      </label>
      <UnidadeMedidaInput
        productFamily={productFamily}
        value={unidadeDeMedida}
        onChange={setUnidadeDeMedida}
      />
      <label className="text-xs font-medium text-slate-600">
        package content (in that unit)
        <input
          type="number"
          step="0.01"
          min="0"
          value={conteudoEmbalagem}
          onChange={(e) => setConteudoEmbalagem(e.target.value)}
          placeholder="e.g.: 450"
          className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-2 text-base sm:min-h-9 sm:text-sm"
        />
      </label>
      {erro && (
        <p role="status" className="col-span-1 text-xs text-red-600 sm:col-span-2">
          couldn&apos;t save, try again
        </p>
      )}
      <button
        type="submit"
        disabled={salvando}
        className="col-span-1 mt-1 min-h-11 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:col-span-2"
      >
        {salvando ? "saving…" : "save"}
      </button>
      <button
        type="button"
        disabled={salvando}
        onClick={() => {
          if (
            window.confirm(
              `Delete "${produto.nome}"? It disappears from every list (shelf, market, to-buy, history keeps its own record). This can be undone, but only by asking me directly — there's no "restore" button yet.`,
            )
          ) {
            onSalvar({ ativo: false });
          }
        }}
        className="col-span-1 min-h-9 rounded-md px-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 sm:col-span-2"
      >
        delete product
      </button>
    </form>
  );
}
