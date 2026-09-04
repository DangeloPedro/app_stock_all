import { formatMoeda, type Moeda } from "@/lib/moeda";

// Barra horizontal proporcional por linha (largura em CSS, sem lib de
// gráfico) — usado pra "share of spend" por loja/família. Espera as linhas
// já ordenadas/agregadas (ex.: top 5 + "other") por quem chama.
export function ProportionalBarList({
  rows,
  total,
  moeda,
}: {
  rows: { label: string; value: number }[];
  total: number;
  moeda: Moeda;
}) {
  const maior = Math.max(...rows.map((r) => r.value), 0.01);

  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const pct = total > 0 ? (r.value / total) * 100 : 0;
        const largura = Math.max((r.value / maior) * 100, 2);
        return (
          <li key={r.label} className="space-y-0.5">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
              <span className="truncate">{r.label}</span>
              <span className="shrink-0 tabular-nums">
                {formatMoeda(r.value, moeda)} · {pct.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${largura}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
