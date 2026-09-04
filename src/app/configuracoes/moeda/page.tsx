import { TabsNav } from "../TabsNav";
import { MoedaForm } from "../MoedaForm";

export default function MoedaPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">settings</h1>
        <p className="text-sm text-slate-500">
          currency used to display prices across the whole app — doesn't
          convert past values, just changes how they're shown.
        </p>
      </div>

      <TabsNav />

      <MoedaForm />
    </div>
  );
}
