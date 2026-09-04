import { prisma } from "@/lib/prisma";
import { LojaRow } from "./LojaRow";
import { NovaLojaForm } from "./NovaLojaForm";
import { TabsNav } from "./TabsNav";

export const dynamic = "force-dynamic";

export default async function LojasPage() {
  const lojas = await prisma.loja.findMany({ orderBy: { nome: "asc" } });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">settings</h1>
        <p className="text-sm text-slate-500">
          editable — found a new store? add it here. stopped going to one?
          deactivate instead of deleting, to keep the purchase history
          already logged there.
        </p>
      </div>

      <TabsNav />

      <NovaLojaForm />

      <ul className="space-y-2">
        {lojas.map((loja) => (
          <LojaRow key={loja.id} loja={loja} />
        ))}
      </ul>
    </div>
  );
}
