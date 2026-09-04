"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FamilyInput } from "@/components/FamilyInput";
import { LocalizacaoSelect } from "@/components/LocalizacaoSelect";
import { PrecosInput } from "@/components/PrecosInput";
import { UnidadeMedidaInput } from "@/components/UnidadeMedidaInput";

export function NovoProdutoForm() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [productFamily, setProductFamily] = useState("");
  const [localizacaoId, setLocalizacaoId] = useState("");
  const [unidadeDeMedida, setUnidadeDeMedida] = useState("");
  const [conteudoEmbalagem, setConteudoEmbalagem] = useState("");
  const [quantidadePadrao, setQuantidadePadrao] = useState("");
  const [precos, setPrecos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function limpar() {
    setNome("");
    setProductFamily("");
    setLocalizacaoId("");
    setUnidadeDeMedida("");
    setConteudoEmbalagem("");
    setQuantidadePadrao("");
    setPrecos({});
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          productFamily,
          status: "catalogado",
          localizacaoId: localizacaoId || null,
          unidadeDeMedida: unidadeDeMedida || null,
          conteudoEmbalagem: conteudoEmbalagem ? Number(conteudoEmbalagem) : null,
          quantidadePadrao: quantidadePadrao ? Number(quantidadePadrao) : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErro(body?.error ? JSON.stringify(body.error) : "error creating product");
        return;
      }
      const produto = await res.json();

      // Preços por mercado são uma tabela separada (PrecoReferencia) — salva
      // um PUT por mercado preenchido, depois de o produto já existir.
      const entradas = Object.entries(precos).filter(
        ([, valor]) => valor && Number(valor) > 0,
      );
      await Promise.all(
        entradas.map(([lojaId, valor]) =>
          fetch(`/api/produtos/${produto.id}/precos`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lojaId, preco: Number(valor) }),
          }),
        ),
      );

      limpar();
      setAberto(false);
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="min-h-12 w-full rounded-lg border border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 active:bg-slate-50"
      >
        + new product
      </button>
    );
  }

  return (
    <form
      onSubmit={criar}
      className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2"
    >
      <label className="col-span-1 block text-xs font-medium text-slate-600 sm:col-span-2">
        name
        <input
          value={nome}
          required
          onChange={(e) => setNome(e.target.value)}
          placeholder="e.g.: Nestle Light Greek Yogurt Strawberry - 4 pack"
          className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-2 text-base sm:min-h-9 sm:text-sm"
        />
        <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
          brand + name + unit
        </span>
      </label>
      <label className="col-span-1 block text-xs font-medium text-slate-600 sm:col-span-2">
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
      <PrecosInput value={precos} onChange={setPrecos} />
      {erro && (
        <p role="status" className="col-span-1 text-xs text-red-600 sm:col-span-2">
          {erro}
        </p>
      )}
      <div className="col-span-1 flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={enviando}
          className="min-h-11 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50"
        >
          {enviando ? "creating…" : "create"}
        </button>
        <button
          type="button"
          onClick={() => {
            limpar();
            setAberto(false);
          }}
          className="min-h-11 rounded-md px-3 text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          cancel
        </button>
      </div>
    </form>
  );
}
