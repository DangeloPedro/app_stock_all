import { prisma } from "@/lib/prisma";
import { ProdutoCard } from "@/components/ProdutoCard";

export const dynamic = "force-dynamic";

const SEM_LOCAL = "no location set";

export default async function ShelfPage() {
  const produtos = await prisma.produto.findMany({
    where: { status: "em_casa", ativo: true },
    include: { localizacao: true },
    orderBy: [{ localizacao: { nome: "asc" } }, { nome: "asc" }],
  });

  // Último preço pago por produto (qualquer loja) — mesma lógica do
  // market-shelf: já vem ordenado por data desc, então a primeira
  // ocorrência de cada produtoId é a mais recente.
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

  const grupos = new Map<string, typeof produtos>();
  for (const produto of produtos) {
    const chave = produto.localizacao?.nome ?? SEM_LOCAL;
    const grupo = grupos.get(chave) ?? [];
    grupo.push(produto);
    grupos.set(chave, grupo);
  }
  // "Sem local definido" sempre por último, o resto em ordem alfabética.
  const gruposOrdenados = Array.from(grupos.entries()).sort(([a], [b]) => {
    if (a === SEM_LOCAL) return 1;
    if (b === SEM_LOCAL) return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">shelf</h1>

      {produtos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          nothing at home registered yet.
        </p>
      ) : (
        gruposOrdenados.map(([local, itens]) => (
          <section key={local}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {local}
            </h2>
            <ul className="space-y-2">
              {itens.map((produto) => (
                <ProdutoCard
                  key={produto.id}
                  produto={produto}
                  ultimoEvento={ultimoPrecoPorProduto.get(produto.id) ?? null}
                  mode="shelf"
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
