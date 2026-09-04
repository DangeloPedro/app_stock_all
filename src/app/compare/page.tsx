import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { precosPorLojaParaProdutos, type PrecoPorLoja } from "@/lib/precos";
import { getMoedaAtual } from "@/lib/moeda";
import { FamiliaSelect } from "./FamiliaSelect";
import { TabelaComparacao } from "./TabelaComparacao";

export const dynamic = "force-dynamic";

// /compare?family=X — comparação lado a lado dos produtos de uma família em
// todos os mercados. Existe porque "prices by store" resolve um produto de
// cada vez: com 3 produtos × 3 lojas viravam 9 linhas espalhadas por 3
// painéis, longe demais uma da outra pra comparar de olho.
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ family?: string }>;
}) {
  const { family = "" } = await searchParams;

  const familias = (
    await prisma.produto.groupBy({
      by: ["productFamily"],
      where: { ativo: true, productFamily: { not: "" } },
      _count: { _all: true },
      orderBy: { productFamily: "asc" },
    })
  ).map((g) => ({ nome: g.productFamily, quantidade: g._count._all }));

  // Família que não existe mais (renomeada/deletada em /configuracoes, link
  // antigo) cai no estado vazio com aviso, em vez de tabela em branco.
  const selecionada = familias.some((f) => f.nome === family) ? family : "";
  const familiaSumiu = family !== "" && selecionada === "";

  const produtos = selecionada
    ? await prisma.produto.findMany({
        where: { ativo: true, productFamily: selecionada },
        orderBy: { nome: "asc" },
      })
    : [];

  const [{ lojas, precosDoProduto }, moeda] = await Promise.all([
    precosPorLojaParaProdutos(produtos.map((p) => p.id)),
    getMoedaAtual(),
  ]);
  const precos: Record<string, PrecoPorLoja[]> = Object.fromEntries(
    produtos.map((p) => [p.id, precosDoProduto(p.id)]),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">compare prices</h1>
        <p className="mt-1 text-sm text-slate-500">
          one family at a time, every store side by side — priced per kg, L or
          unit so different pack sizes line up.
        </p>
      </div>

      {familias.length > 0 && (
        <FamiliaSelect familias={familias} selecionada={selecionada} />
      )}

      {familiaSumiu && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          &ldquo;{family}&rdquo; isn&apos;t a family anymore — it may have been
          renamed or deleted. pick another one above.
        </p>
      )}

      {familias.length === 0 ? (
        <Vazio>
          no families yet. give products a family in{" "}
          <Atalho href="/market-shelf">market/shelf</Atalho> and they show up
          here.
        </Vazio>
      ) : !selecionada ? (
        <Vazio>
          pick a family above to compare its products. you can also jump
          straight here from a family in{" "}
          <Atalho href="/market-shelf">market/shelf</Atalho>.
        </Vazio>
      ) : lojas.length === 0 ? (
        <Vazio>
          no active stores. add one in{" "}
          <Atalho href="/configuracoes">settings</Atalho> to compare prices.
        </Vazio>
      ) : (
        <>
          <p className="text-xs text-slate-400">
            {produtos.length} product{produtos.length === 1 ? "" : "s"} ·{" "}
            {lojas.length} store{lojas.length === 1 ? "" : "s"}
          </p>
          <TabelaComparacao
            produtos={produtos}
            lojas={lojas}
            precos={precos}
            moeda={moeda}
          />
        </>
      )}
    </div>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

function Atalho({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-blue-600 hover:text-blue-700">
      {children}
    </Link>
  );
}
