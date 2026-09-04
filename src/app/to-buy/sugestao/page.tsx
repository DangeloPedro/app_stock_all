import { prisma } from "@/lib/prisma";
import { precosPorLojaParaProdutos } from "@/lib/precos";
import { getMoedaAtual, formatMoeda } from "@/lib/moeda";
import { TabsNav } from "../TabsNav";
import { UsarSugestaoButton } from "./UsarSugestaoButton";

export const dynamic = "force-dynamic";

const SEM_PRECO = "no known price at any store";

export default async function SugestaoPage() {
  const moeda = await getMoedaAtual();
  const produtos = await prisma.produto.findMany({
    where: { status: "na_lista", ativo: true },
    orderBy: [{ productFamily: "asc" }, { nome: "asc" }],
  });

  const { precosDoProduto } = await precosPorLojaParaProdutos(
    produtos.map((p) => p.id),
  );

  type ItemSugerido = {
    produtoId: string;
    nome: string;
    quantidade: number;
    preco: number;
  };
  const grupos = new Map<string, ItemSugerido[]>();
  const semPreco: typeof produtos = [];
  const atribuicoes: { produtoId: string; lojaId: string }[] = [];

  for (const produto of produtos) {
    const precos = precosDoProduto(produto.id).filter(
      (p): p is { lojaId: string; lojaNome: string; preco: number } =>
        p.preco !== null,
    );
    if (precos.length === 0) {
      semPreco.push(produto);
      continue;
    }
    const melhor = precos.reduce((a, b) => (b.preco < a.preco ? b : a));
    const quantidade = produto.quantidadePadrao ?? 1;
    const grupo = grupos.get(melhor.lojaNome) ?? [];
    grupo.push({
      produtoId: produto.id,
      nome: produto.nome,
      quantidade,
      preco: melhor.preco,
    });
    grupos.set(melhor.lojaNome, grupo);
    atribuicoes.push({ produtoId: produto.id, lojaId: melhor.lojaId });
  }

  const gruposOrdenados = Array.from(grupos.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const totalGeral = gruposOrdenados.reduce(
    (acc, [, itens]) =>
      acc + itens.reduce((s, i) => s + i.preco * i.quantidade, 0),
    0,
  );
  const sugestaoComPreco = produtos.length - semPreco.length;

  // Comparação de 2 vias: plano atual (mercado já atribuído por item, aba
  // Editável) contra esta sugestão (mais barato por item). Cobertura
  // sempre mostrada; diferença de valor só quando os dois cobrem TODOS os
  // itens — comparar contra cobertura parcial enganaria mais que ajudaria.
  let planoAtualTotal = 0;
  let planoAtualComPreco = 0;
  for (const produto of produtos) {
    if (!produto.lojaPreferidaId) continue;
    const preco =
      precosDoProduto(produto.id).find(
        (p) => p.lojaId === produto.lojaPreferidaId,
      )?.preco ?? null;
    if (preco === null) continue;
    planoAtualComPreco += 1;
    planoAtualTotal += preco * (produto.quantidadePadrao ?? 1);
  }
  const comparacaoCompleta =
    produtos.length > 0 &&
    planoAtualComPreco === produtos.length &&
    sugestaoComPreco === produtos.length;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">to buy</h1>
      <TabsNav />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          each item goes to the store with the lowest known price (reference
          or last purchase). no per-unit normalization yet — compares raw
          price.
        </p>
        <UsarSugestaoButton atribuicoes={atribuicoes} />
      </div>

      {produtos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          empty list.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                current plan
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {formatMoeda(planoAtualTotal, moeda)}
              </p>
              <p className="text-xs tabular-nums text-slate-500">
                {planoAtualComPreco}/{produtos.length} priced
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
                cheapest per item
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {formatMoeda(totalGeral, moeda)}
              </p>
              <p className="text-xs tabular-nums text-slate-500">
                {sugestaoComPreco}/{produtos.length} priced
                {comparacaoCompleta && (
                  <>
                    {" "}
                    ·{" "}
                    {planoAtualTotal - totalGeral >= 0.01
                      ? `saves ${formatMoeda(planoAtualTotal - totalGeral, moeda)}`
                      : "same as current plan"}
                  </>
                )}
              </p>
            </div>
          </div>

          {gruposOrdenados.map(([loja, itens]) => {
            const subtotal = itens.reduce(
              (s, i) => s + i.preco * i.quantidade,
              0,
            );
            return (
              <section
                key={loja}
                className="rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {loja}
                  </h2>
                  <span className="text-sm font-medium tabular-nums text-slate-700">
                    {formatMoeda(subtotal, moeda)}
                  </span>
                </div>
                <ul className="space-y-1">
                  {itens.map((item) => (
                    <li
                      key={item.produtoId}
                      className="flex justify-between text-sm text-slate-600"
                    >
                      <span>
                        {item.nome}{" "}
                        <span className="text-slate-400">× {item.quantidade}</span>
                      </span>
                      <span className="tabular-nums">
                        {formatMoeda(item.preco * item.quantidade, moeda)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {semPreco.length > 0 && (
            <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
              <h2 className="mb-2 text-sm font-semibold text-slate-500">
                {SEM_PRECO}
              </h2>
              <ul className="space-y-1">
                {semPreco.map((produto) => (
                  <li key={produto.id} className="text-sm text-slate-500">
                    {produto.nome}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
