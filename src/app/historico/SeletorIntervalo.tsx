"use client";

import { useState } from "react";

export type IntervaloData = { inicio: string; fim: string }; // yyyy-mm-dd

function formatISO(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatCurto(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const DIAS_SEMANA = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Grade do mês exibido, com células vazias antes do dia 1 pra alinhar com
// o dia da semana correto — um mês só por vez (sem rolagem/múltiplos
// meses), navegado pelas setinhas.
function diasDoMes(mesExibido: Date) {
  const ano = mesExibido.getFullYear();
  const mes = mesExibido.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const celulas: (Date | null)[] = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= totalDias; d++) celulas.push(new Date(ano, mes, d));
  return celulas;
}

// Botão "custom range" que abre um calendário de um mês (setinhas ‹ › pra
// trocar de mês). Primeiro clique marca a data inicial; segundo clique
// (numa data >= inicial) marca a final e já aplica, fechando o popover.
// Clicar de novo depois de ter as duas datas recomeça a seleção.
export function SeletorIntervalo({
  value,
  onChange,
}: {
  value: IntervaloData | null;
  onChange: (valor: IntervaloData) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [mesExibido, setMesExibido] = useState(() => {
    const base = value ? new Date(`${value.fim}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [rascunho, setRascunho] = useState<{
    inicio: string | null;
    fim: string | null;
  }>({ inicio: value?.inicio ?? null, fim: value?.fim ?? null });

  // clicarDia roda dentro de um onClick (evento real, não durante render),
  // então lê `rascunho` direto do closure em vez do padrão `prev =>` — o
  // padrão funcional é para quando o setState tem efeito colateral (como
  // chamar o onChange do componente pai), e chamar setState de outro
  // componente de dentro de uma função updater é exatamente o que o React
  // avisa como inseguro ("Cannot update a component while rendering a
  // different component"): a updater roda na fase de render daquele
  // setState, então side effects nela — inclusive setState de outro
  // componente — podem disparar no momento errado.
  function clicarDia(data: Date) {
    const iso = formatISO(data);

    if (!rascunho.inicio || (rascunho.inicio && rascunho.fim)) {
      setRascunho({ inicio: iso, fim: null });
      return;
    }
    if (iso < rascunho.inicio) {
      setRascunho({ inicio: iso, fim: null });
      return;
    }
    const proximo = { inicio: rascunho.inicio, fim: iso };
    setRascunho(proximo);
    onChange(proximo);
    setAberto(false);
  }

  function mudarMes(delta: number) {
    setMesExibido((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function estaNoIntervalo(data: Date) {
    if (!rascunho.inicio) return false;
    const iso = formatISO(data);
    const fim = rascunho.fim ?? rascunho.inicio;
    return iso >= rascunho.inicio && iso <= fim;
  }

  const celulas = diasDoMes(mesExibido);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`min-h-9 rounded-md px-2.5 text-xs font-medium ${
          value
            ? "bg-slate-900 text-white"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        {value ? `${formatCurto(value.inicio)} – ${formatCurto(value.fim)}` : "custom range"}
      </button>

      {aberto && (
        <div className="absolute right-0 z-10 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => mudarMes(-1)}
              className="min-h-11 min-w-11 rounded text-base text-slate-500 hover:bg-slate-100"
            >
              ‹
            </button>
            <span className="text-sm font-medium text-slate-900">
              {mesExibido.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              type="button"
              onClick={() => mudarMes(1)}
              className="min-h-11 min-w-11 rounded text-base text-slate-500 hover:bg-slate-100"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-slate-400">
            {DIAS_SEMANA.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {celulas.map((data, i) => {
              if (!data) return <span key={i} />;
              const iso = formatISO(data);
              const selecionado = iso === rascunho.inicio || iso === rascunho.fim;
              const noIntervalo = !selecionado && estaNoIntervalo(data);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => clicarDia(data)}
                  className={`min-h-9 rounded text-xs ${
                    selecionado
                      ? "bg-slate-900 text-white"
                      : noIntervalo
                        ? "bg-slate-100 text-slate-700"
                        : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {data.getDate()}
                </button>
              );
            })}
          </div>

          {rascunho.inicio && (
            <p className="mt-2 text-center text-[11px] text-slate-400">
              {rascunho.fim
                ? `${formatCurto(rascunho.inicio)} – ${formatCurto(rascunho.fim)}`
                : `${formatCurto(rascunho.inicio)} – pick end date`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
