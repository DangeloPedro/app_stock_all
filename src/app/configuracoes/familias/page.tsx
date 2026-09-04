import { prisma } from "@/lib/prisma";
import { FamiliaRow } from "../FamiliaRow";
import { TabsNav } from "../TabsNav";

export const dynamic = "force-dynamic";

export default async function FamiliasPage() {
  const [grupos, travas] = await Promise.all([
    prisma.produto.groupBy({
      by: ["productFamily"],
      _count: { _all: true },
      orderBy: { productFamily: "asc" },
    }),
    prisma.familiaUnidade.findMany(),
  ]);
  const travaPorNome = new Map(travas.map((t) => [t.nome, t.unidadeDeMedida]));
  // "" representa "sem família" (produto que teve a família deletada) —
  // não é uma família de verdade, então não aparece aqui pra renomear/apagar.
  const familias = grupos
    .filter((g) => g.productFamily !== "")
    .map((g) => ({
      nome: g.productFamily,
      quantidade: g._count._all,
      unidadeDeMedida: travaPorNome.get(g.productFamily) ?? null,
    }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">settings</h1>
        <p className="text-sm text-slate-500">
          family is the label used to group variants on the shopping list
          (e.g.: "yogurt", "olive oil"). renaming here updates every product
          using that name at once — renaming to a name that already exists
          merges the two families. deleting a family doesn't delete its
          products — they're just left without a family. the first product
          added to a family also locks its unit of measurement for every
          product that comes after — change or clear that lock below.
        </p>
      </div>

      <TabsNav />

      {familias.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          no products registered yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {familias.map((familia) => (
            <FamiliaRow key={familia.nome} familia={familia} />
          ))}
        </ul>
      )}
    </div>
  );
}
