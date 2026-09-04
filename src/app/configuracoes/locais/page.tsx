import { prisma } from "@/lib/prisma";
import { LocalizacaoRow } from "../LocalizacaoRow";
import { NovaLocalizacaoForm } from "../NovaLocalizacaoForm";
import { TabsNav } from "../TabsNav";

export const dynamic = "force-dynamic";

export default async function LocaisPage() {
  const localizacoes = await prisma.localizacao.findMany({
    orderBy: { nome: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">settings</h1>
        <p className="text-sm text-slate-500">
          editable — used to organize the "shelf" tab. deactivating doesn't
          erase history, it just drops off the list of options.
        </p>
      </div>

      <TabsNav />

      <NovaLocalizacaoForm />

      <ul className="space-y-2">
        {localizacoes.map((loc) => (
          <LocalizacaoRow key={loc.id} localizacao={loc} />
        ))}
      </ul>
    </div>
  );
}
