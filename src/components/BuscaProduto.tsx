"use client";

import { useEffect, useRef, useState } from "react";

export type ProdutoBusca = {
  id: string;
  nome: string;
  productFamily: string;
  quantidadePadrao: number | null;
};

// Barra de busca com autocomplete sobre o catálogo inteiro (qualquer status
// — usada tanto em "ate out" (registra algo já comprado e comido, não
// precisa estar na_lista nem em_casa) quanto na revisão do scan de nota
// (adicionar ali um produto do catálogo que a lista pré-carregada não
// trouxe — porque não está em na_lista, ou tem loja preferida diferente da
// da nota). Debounced pra não disparar uma requisição por tecla; some da
// tela assim que um produto é escolhido (quem chama decide quando reabrir,
// via a prop `key` remontando o componente).
export function BuscaProduto({
  onEscolher,
  excluirIds,
  autoFocus,
}: {
  onEscolher: (produto: ProdutoBusca) => void;
  // Produtos já adicionados não devem reaparecer nos resultados.
  excluirIds: Set<string>;
  autoFocus?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ProdutoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    setErro(false);
    const timeoutId = setTimeout(() => {
      fetch(`/api/produtos?ativo=true&q=${encodeURIComponent(termo)}`)
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((data: ProdutoBusca[]) => setResultados(data.slice(0, 8)))
        .catch(() => setErro(true))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [busca]);

  const resultadosFiltrados = resultados.filter((p) => !excluirIds.has(p.id));

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="search a product you bought…"
        className="min-h-11 w-full rounded-md border border-slate-300 px-3 text-base sm:min-h-9 sm:text-sm"
      />
      {busca.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          {buscando && (
            <p className="px-3 py-2 text-xs text-slate-400">searching…</p>
          )}
          {!buscando && erro && (
            <p className="px-3 py-2 text-xs text-red-600">
              couldn&apos;t search — try again
            </p>
          )}
          {!buscando && !erro && resultadosFiltrados.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400">
              no matching product in the catalog
            </p>
          )}
          {!buscando &&
            !erro &&
            resultadosFiltrados.map((produto) => (
              <button
                key={produto.id}
                type="button"
                onClick={() => {
                  onEscolher(produto);
                  setBusca("");
                  setResultados([]);
                }}
                className="block min-h-11 w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {produto.nome}
                <span className="ml-2 text-xs text-slate-400">
                  {produto.productFamily}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
