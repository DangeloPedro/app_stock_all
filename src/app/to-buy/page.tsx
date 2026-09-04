import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { precosPorLojaParaProdutos } from "@/lib/precos";
import { getMoedaAtual, formatMoeda } from "@/lib/moeda";
import { TabsNav } from "./TabsNav";
import { SecaoMercado, type ItemToBuy } from "./SecaoMercado";

export const dynamic = "force-dynamic";

const SEM_MERCADO = "no store set";

export default async function ToBuyEditavelPage() {
  const moeda = await getMoedaAtual();
  const produtos = await prisma.produto.findMany({
    where: { status: "na_lista", ativo: true },
    include: { lojaPreferida: true },
    orderBy: [{ productFamily: "asc" }, { nome: "asc" }],
  });

  const { precosDoProduto } = await precosPorLojaParaProdutos(
    produtos.map((p) => p.id),
  );

  // Preço estimado = preço conhecido especificamente pro mercado JÁ
  // ATRIBUÍDO a este item (não "o mais barato" — essa é a aba Sugestão).
  const precoEstimadoPorProduto = new Map<string, number | null>();
  for (const produto of produtos) {
    if (!produto.lojaPreferidaId) {
      precoEstimadoPorProduto.set(produto.id, null);
      continue;
    }
    const preco =
      precosDoProduto(produto.id).find(
        (p) => p.lojaId === produto.lojaPreferidaId,
      )?.preco ?? null;
    precoEstimadoPorProduto.set(produto.id, preco);
  }

  const grupos = new Map<string, ItemToBuy[]>();
  for (const produto of produtos) {
    const chave = produto.lojaPreferida?.nome ?? SEM_MERCADO;
    const grupo = grupos.get(chave) ?? [];
    grupo.push({
      id: produto.id,
      nome: produto.nome,
      quantidadePadrao: produto.quantidadePadrao,
      lojaPreferidaId: produto.lojaPreferidaId,
      pegoNoMercado: produto.pegoNoMercado,
      precoEstimado: precoEstimadoPorProduto.get(produto.id) ?? null,
    });
    grupos.set(chave, grupo);
  }
  const gruposOrdenados = Array.from(grupos.entries()).sort(([a], [b]) => {
    if (a === SEM_MERCADO) return 1;
    if (b === SEM_MERCADO) return -1;
    return a.localeCompare(b);
  });

  const totalGeral = produtos.reduce((acc, p) => {
    const preco = precoEstimadoPorProduto.get(p.id);
    if (preco === null || preco === undefined) return acc;
    return acc + preco * (p.quantidadePadrao ?? 1);
  }, 0);
  const produtosComPreco = produtos.filter(
    (p) => precoEstimadoPorProduto.get(p.id) != null,
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">to buy</h1>
        <div className="flex gap-2">
          <Link
            href="/to-buy/ate-fora"
            className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center"
          >
            grabbed & eaten
          </Link>
          <Link
            href="/to-buy/scan"
            className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center"
          >
            scan receipt
          </Link>
        </div>
      </div>
      <TabsNav />

      {produtos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          empty list. add items from market/shelf.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            <span className="font-semibold tabular-nums text-slate-900">
              {formatMoeda(totalGeral, moeda)}
            </span>{" "}
            estimated ·{" "}
            <span className="tabular-nums">
              {produtosComPreco}/{produtos.length}
            </span>{" "}
            items priced
          </p>

          {gruposOrdenados.map(([loja, itens]) => {
            const subtotal = itens.reduce((s, i) => {
              if (i.precoEstimado === null) return s;
              return s + i.precoEstimado * (i.quantidadePadrao ?? 1);
            }, 0);
            return (
              <SecaoMercado
                key={loja}
                loja={loja}
                itens={itens}
                subtotal={subtotal}
                confirmavel={loja !== SEM_MERCADO}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
