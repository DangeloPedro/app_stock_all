import { formatMoeda, type Moeda } from "@/lib/moeda";
import type { EventoSimples } from "./tipos";

type Bin = { label: string; total: number };

function agruparPorSemana(
  eventos: EventoSimples[],
  inicio: Date,
  fim: Date,
): Bin[] {
  const bins: Bin[] = [];
  const cursor = new Date(inicio);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  while (cursor.getTime() <= fim.getTime()) {
    const fimSemana = new Date(cursor);
    fimSemana.setDate(fimSemana.getDate() + 7);
    const total = eventos.reduce((acc, e) => {
      const t = new Date(e.data).getTime();
      return t >= cursor.getTime() && t < fimSemana.getTime()
        ? acc + e.precoPago
        : acc;
    }, 0);
    bins.push({
      label: cursor.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      total,
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return bins;
}

function agruparPorMes(eventos: EventoSimples[], inicio: Date, fim: Date): Bin[] {
  const bins: Bin[] = [];
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const limite = new Date(fim.getFullYear(), fim.getMonth(), 1);
  while (cursor.getTime() <= limite.getTime()) {
    const proximo = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const total = eventos.reduce((acc, e) => {
      const t = new Date(e.data).getTime();
      return t >= cursor.getTime() && t < proximo.getTime()
        ? acc + e.precoPago
        : acc;
    }, 0);
    bins.push({
      label: cursor.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      total,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return bins;
}

// No máximo `max` barras — o excedente mais antigo vira uma barra "older"
// agregada em vez de espremer o gráfico horizontalmente.
function limitarBins(bins: Bin[], max: number): Bin[] {
  if (bins.length <= max) return bins;
  const corte = bins.length - (max - 1);
  const antigos = bins.slice(0, corte);
  const recentes = bins.slice(corte);
  const older: Bin = {
    label: "older",
    total: antigos.reduce((s, b) => s + b.total, 0),
  };
  return [older, ...recentes];
}

// Timeline compacta de gasto — semanal pra até ~90 dias de intervalo real
// dos dados, mensal acima disso, sempre no máximo 13 barras. Zero
// dependência (só CSS); sem eixo/legenda/hover — só as barras com valor
// no title (tooltip nativo) e um rótulo curto embaixo de cada uma.
export function SpendTimeline({
  eventos,
  moeda,
}: {
  eventos: EventoSimples[];
  moeda: Moeda;
}) {
  if (eventos.length === 0) return null;

  const datas = eventos.map((e) => new Date(e.data).getTime());
  const inicio = new Date(Math.min(...datas));
  const fim = new Date(Math.max(...datas));
  const spanDias = (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);
  const mensal = spanDias > 90;

  const bins = limitarBins(
    mensal
      ? agruparPorMes(eventos, inicio, fim)
      : agruparPorSemana(eventos, inicio, fim),
    13,
  );
  const maior = Math.max(...bins.map((b) => b.total), 0.01);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        spend over time ({mensal ? "monthly" : "weekly"})
      </p>
      <div className="mt-3 flex h-20 items-end gap-1">
        {bins.map((bin, i) => (
          <div
            key={i}
            title={`${bin.label}: ${formatMoeda(bin.total, moeda)}`}
            className="flex-1 rounded-t bg-blue-500"
            style={{ height: `${Math.max((bin.total / maior) * 100, 2)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {bins.map((bin, i) => (
          <div
            key={i}
            className="flex-1 truncate text-center text-[9px] text-slate-400"
          >
            {bin.label}
          </div>
        ))}
      </div>
    </section>
  );
}
