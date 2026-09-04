import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProdutoCard } from "@/components/ProdutoCard";
import { NovoProdutoForm } from "./NovoProdutoForm";

export const dynamic = "force-dynamic";

// "market/shelf" = tudo que não está em to-buy (catalogado + em_casa juntos,
// com selo mostrando qual dos dois cada item está).
export default async function MarketShelfPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  const produtos = await prisma.produto.findMany({
    where: {
      ativo: true,
      status: { in: ["catalogado", "em_casa"] },
      ...(q
        ? {
            OR: [
              { nome: { contains: q, mode: "insensitive" as const } },
              { productFamily: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: { localizacao: true },
    orderBy: [{ productFamily: "asc" }, { nome: "asc" }],
  });

  // Último preço pago por produto (qualquer loja) — uma query só, reduzida
  // em JS: como já vem ordenado por data desc, a primeira ocorrência de cada
  // produtoId é a mais recente.
  const eventos = await prisma.eventoDeCompra.findMany({
    where: { produtoId: { in: produtos.map((p) => p.id) } },
    include: { loja: true },
    orderBy: { data: "desc" },
  });
  const ultimoPrecoPorProduto = new Map<string, (typeof eventos)[number]>();
  for (const evento of eventos) {
    if (!ultimoPrecoPorProduto.has(evento.produtoId)) {
      ultimoPrecoPorProduto.set(evento.produtoId, evento);
    }
  }

  // Toda família vira sua própria seção, mesmo com 1 produto só — assim uma
  // família recém-criada já aparece com cabeçalho, sem esperar ganhar um
  // segundo produto. Só produto sem família (productFamily === "", família
  // deletada em /configuracoes/familias) sempre cai em "other" — não faz
  // sentido virar seção com cabeçalho vazio.
  const porFamilia = new Map<string, typeof produtos>();
  for (const produto of produtos) {
    const grupo = porFamilia.get(produto.productFamily) ?? [];
    grupo.push(produto);
    porFamilia.set(produto.productFamily, grupo);
  }
  // Dentro de cada família, shelf (em_casa — já em casa) vem antes de
  // market (catalogado — só conhecido) — o que já tá em casa tem
  // prioridade visual sobre o que ainda falta comprar.
  function porStatusDepoisNome(a: (typeof produtos)[number], b: (typeof produtos)[number]) {
    if (a.status !== b.status) return a.status === "em_casa" ? -1 : 1;
    return a.nome.localeCompare(b.nome);
  }

  const familiasAgrupadas = Array.from(porFamilia.entries())
    .filter(([familia]) => familia !== "")
    .map(
      ([familia, itens]): [string, typeof produtos] => [
        familia,
        [...itens].sort(porStatusDepoisNome),
      ],
    )
    .sort(([a], [b]) => a.localeCompare(b));
  const produtosSoltos = porFamilia.get("") ?? [];

  const semResultados = produtos.length === 0;
  const filtroAtivo = q.trim() !== "";

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">market/shelf</h1>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="search by name or family…"
          className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 text-base sm:min-h-9 sm:text-sm"
        />
        <button
          type="submit"
          className="min-h-11 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 active:bg-slate-950 sm:min-h-9"
        >
          filter
        </button>
      </form>

      <NovoProdutoForm />

      {!semResultados && (
        <p className="text-xs text-slate-400">
          {produtos.length} product{produtos.length === 1 ? "" : "s"} · sorted
          by family
        </p>
      )}

      {semResultados ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          {filtroAtivo ? (
            <>
              no matching products.{" "}
              <Link
                href="/market-shelf"
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                clear filters
              </Link>
            </>
          ) : (
            "no products yet."
          )}
        </p>
      ) : q.trim() !== "" ? (
        // Busca ativa: sempre lista solta, sem cabeçalho de família — evita
        // resultados espalhados em várias seções de 1 item.
        <ul className="space-y-2">
          {produtos.map((produto) => (
            <ProdutoCard
              key={produto.id}
              produto={produto}
              ultimoEvento={ultimoPrecoPorProduto.get(produto.id) ?? null}
              mode="catalog"
            />
          ))}
        </ul>
      ) : (
        <>
          {familiasAgrupadas.map(([familia, itens]) => (
            <section key={familia}>
              {/* Atalho pra /compare só com 2+ produtos: comparar uma
                  família de um item só não tem o que comparar. */}
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {familia}
                </h2>
                {itens.length > 1 && (
                  <Link
                    href={`/compare?family=${encodeURIComponent(familia)}`}
                    className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    compare prices
                  </Link>
                )}
              </div>
              <ul className="space-y-2">
                {itens.map((produto) => (
                  <ProdutoCard
                    key={produto.id}
                    produto={produto}
                    ultimoEvento={ultimoPrecoPorProduto.get(produto.id) ?? null}
                    mode="catalog"
                  />
                ))}
              </ul>
            </section>
          ))}
          {produtosSoltos.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                other
              </h2>
              <ul className="space-y-2">
                {produtosSoltos.map((produto) => (
                  <ProdutoCard
                    key={produto.id}
                    produto={produto}
                    ultimoEvento={ultimoPrecoPorProduto.get(produto.id) ?? null}
                    mode="catalog"
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
