import { prisma } from "./prisma";

export type PrecoPorLoja = { lojaId: string; lojaNome: string; preco: number | null };

/// Preço "conhecido" por produto × loja = referência manual, senão o último
/// preço realmente pago naquela loja (dividido pela quantidade — sempre por
/// unidade, nunca o total da linha), senão null. Mesma regra de fallback
/// usada em /api/produtos/:id/precos, só que em lote pra várias produtos de
/// uma vez (usado pela aba to-buy > Sugestão/Editável, que olham vários
/// produtos ao mesmo tempo).
export async function precosPorLojaParaProdutos(produtoIds: string[]) {
  const lojas = await prisma.loja.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
  });

  if (produtoIds.length === 0) {
    return { lojas, precosDoProduto: () => lojas.map((l) => ({ lojaId: l.id, lojaNome: l.nome, preco: null })) };
  }

  const [referencias, eventos] = await Promise.all([
    prisma.precoReferencia.findMany({ where: { produtoId: { in: produtoIds } } }),
    prisma.eventoDeCompra.findMany({
      where: { produtoId: { in: produtoIds } },
      orderBy: { data: "desc" },
    }),
  ]);

  const referenciaPorPar = new Map(
    referencias.map((r) => [`${r.produtoId}_${r.lojaId}`, r.preco]),
  );
  const ultimoEventoPorPar = new Map<string, number>();
  for (const e of eventos) {
    const chave = `${e.produtoId}_${e.lojaId}`;
    if (!ultimoEventoPorPar.has(chave)) {
      ultimoEventoPorPar.set(chave, e.precoPago / e.quantidadeComprada);
    }
  }

  function precosDoProduto(produtoId: string): PrecoPorLoja[] {
    return lojas.map((loja) => ({
      lojaId: loja.id,
      lojaNome: loja.nome,
      preco:
        referenciaPorPar.get(`${produtoId}_${loja.id}`) ??
        ultimoEventoPorPar.get(`${produtoId}_${loja.id}`) ??
        null,
    }));
  }

  return { lojas, precosDoProduto };
}
