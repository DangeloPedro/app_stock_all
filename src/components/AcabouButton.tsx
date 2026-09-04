"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoeda } from "@/lib/moeda";
import { useMoeda } from "@/components/MoedaContext";

type PrecoLoja = { lojaId: string; lojaNome: string; preco: number | null };

// Botão "acabou" (ou "+ to buy" pra item ainda no market): manda o produto
// pra to-buy e pede quantos o usuário pretende comprar (vira
// quantidadePadrao, usado como pré-preenchimento na hora de fechar a
// compra). Zerar quantidadeEmEstoque é sempre seguro mesmo vindo do market
// (já é 0 lá).
//
// O <select> de mercado já mostra, em cada opção, o preço total conhecido
// pra quantidade digitada (preço/unidade × quantidade) — decidir onde
// comprar sem precisar abrir "prices by store" à parte, e sem gastar
// espaço vertical extra (o preview mora dentro do próprio dropdown nativo,
// não numa lista aberta na tela).
export function AcabouButton({
  produtoId,
  quantidadePadraoAtual,
  lojaPreferidaAtual = null,
  label = "out",
}: {
  produtoId: string;
  quantidadePadraoAtual: number | null;
  lojaPreferidaAtual?: string | null;
  label?: string;
}) {
  const router = useRouter();
  const moeda = useMoeda();
  const [aberto, setAberto] = useState(false);
  const [quantidade, setQuantidade] = useState(
    quantidadePadraoAtual ? String(quantidadePadraoAtual) : "1",
  );
  const [lojaId, setLojaId] = useState(lojaPreferidaAtual ?? "");
  const [precos, setPrecos] = useState<PrecoLoja[]>([]);
  const [carregandoPrecos, setCarregandoPrecos] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(false);

  async function abrir() {
    setAberto(true);
    if (precos.length === 0) {
      setCarregandoPrecos(true);
      try {
        const res = await fetch(`/api/produtos/${produtoId}/precos`);
        if (res.ok) setPrecos(await res.json());
      } finally {
        setCarregandoPrecos(false);
      }
    }
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(false);
    try {
      const res = await fetch(`/api/produtos/${produtoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "na_lista",
          quantidadePadrao: Number(quantidade),
          quantidadeEmEstoque: 0,
          lojaPreferidaId: lojaId || null,
          // Entrando em na_lista agora — nunca deve vir pré-marcado de uma
          // passagem anterior pela lista (ver comentário no schema).
          pegoNoMercado: false,
        }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
      setAberto(false);
    } catch {
      setErro(true);
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="min-h-11 rounded-md bg-amber-50 px-3 text-xs font-medium text-amber-700 hover:bg-amber-100 active:bg-amber-200"
      >
        {label}
      </button>
    );
  }

  const quantidadeNumero = Number(quantidade) || 0;

  return (
    <form onSubmit={confirmar} className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-slate-500">buy</span>
      <input
        type="number"
        step="1"
        min="0"
        required
        autoFocus
        value={quantidade}
        onChange={(e) => setQuantidade(e.target.value)}
        className="min-h-11 w-16 rounded-md border border-slate-300 px-1.5 text-base sm:min-h-9 sm:text-xs"
      />
      <select
        value={lojaId}
        onChange={(e) => setLojaId(e.target.value)}
        disabled={carregandoPrecos}
        className="min-h-11 rounded-md border border-slate-300 px-1.5 text-base sm:min-h-9 sm:text-xs"
      >
        <option value="">no store assigned</option>
        {precos.map((p) => (
          <option key={p.lojaId} value={p.lojaId}>
            {p.lojaNome}
            {p.preco !== null
              ? ` — ${formatMoeda(p.preco * quantidadeNumero, moeda)}`
              : " — no price yet"}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={salvando}
        className="min-h-11 rounded-md bg-amber-600 px-3 text-xs font-medium text-white hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50"
      >
        ok
      </button>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="min-h-11 px-2 text-xs text-slate-400 hover:text-slate-600"
      >
        cancel
      </button>
      {erro && (
        <span role="status" className="basis-full text-xs text-red-600">
          couldn&apos;t save, try again
        </span>
      )}
    </form>
  );
}
