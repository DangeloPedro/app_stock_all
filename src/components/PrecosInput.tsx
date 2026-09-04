"use client";

import { useEffect, useState } from "react";
import type { Loja } from "@prisma/client";
import { simboloMoeda } from "@/lib/moeda";
import { useMoeda } from "@/components/MoedaContext";

// Inputs de preço de referência por mercado pra usar ANTES de o produto
// existir (formulário de novo produto) — diferente de PrecosPorLoja, que
// edita via API contra um produtoId já criado. Aqui só coleta os valores
// digitados; quem chama decide o que fazer com eles (ex.: salvar um por um
// depois de criar o produto, via PUT /api/produtos/:id/precos).
export function PrecosInput({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}) {
  const moeda = useMoeda();
  const [lojas, setLojas] = useState<Loja[]>([]);
  // Distinto de "lojas.length === 0" de propósito — sem isto, uma falha de
  // fetch fazia essa seção inteira sumir em silêncio (return null), sem
  // nenhum indício de que os preços não puderam ser carregados.
  const [erro, setErro] = useState(false);

  useEffect(() => {
    fetch("/api/lojas?ativo=true")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setLojas)
      .catch(() => setErro(true));
  }, []);

  if (erro) {
    return (
      <p
        role="status"
        className="col-span-1 text-xs text-red-600 sm:col-span-2"
      >
        couldn&apos;t load stores — reload the page to add prices now, or add
        them later from the product&apos;s &quot;prices by store&quot;.
      </p>
    );
  }

  if (lojas.length === 0) return null;

  return (
    <div className="col-span-1 space-y-1 sm:col-span-2">
      <p className="text-xs font-medium text-slate-600">
        prices by store (optional)
      </p>
      <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-2">
        {lojas.map((loja) => (
          <label
            key={loja.id}
            className="flex items-center justify-between gap-2 text-xs text-slate-600"
          >
            <span>{loja.nome}</span>
            <span className="flex items-center gap-1">
              <span className="text-slate-400">{simboloMoeda(moeda)}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={value[loja.id] ?? ""}
                placeholder="—"
                onChange={(e) =>
                  onChange({ ...value, [loja.id]: e.target.value })
                }
                className="min-h-10 w-20 rounded-md border border-slate-300 px-1.5 text-sm text-slate-900"
              />
              <span className="text-slate-400">/unit</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
