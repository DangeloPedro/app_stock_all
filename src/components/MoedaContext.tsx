"use client";

import { createContext, useContext } from "react";
import type { Moeda } from "@/lib/moeda";

// Moeda é configuração global (uma só pro app inteiro, ver /configuracoes >
// currency) — Context evita ter que passar `moeda` como prop por cadeias
// profundas de componente client (SecaoMercado > ItemLista > PrecosPorLoja,
// NovoProdutoForm > PrecosInput, etc.). O valor vem do layout raiz
// (server component, lê via getMoedaAtual()) e se atualiza sozinho depois
// de um router.refresh() — não precisa de estado local aqui.
const MoedaContext = createContext<Moeda>("BRL");

export function MoedaProvider({
  moeda,
  children,
}: {
  moeda: Moeda;
  children: React.ReactNode;
}) {
  return (
    <MoedaContext.Provider value={moeda}>{children}</MoedaContext.Provider>
  );
}

export function useMoeda() {
  return useContext(MoedaContext);
}
