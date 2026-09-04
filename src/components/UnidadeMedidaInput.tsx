"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useFamiliaUnidade } from "./useFamiliaUnidade";

// Campo "unit of measurement" usado em NovoProdutoForm e no EditForm de
// ProdutoCard — trava sozinho assim que a família já tem uma unidade
// definida (ver FamiliaUnidade no schema): o primeiro produto de uma
// família decide a unidade de todos os que vierem depois, e daí em diante
// só muda em /configuracoes/familias. O servidor reforça a mesma regra
// (POST/PATCH /api/produtos) — isto aqui é só a UX combinando com ela.
export function UnidadeMedidaInput({
  productFamily,
  value,
  onChange,
}: {
  productFamily: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const travada = useFamiliaUnidade(productFamily);
  const travado = typeof travada === "string";

  // Assim que a trava chega (ou muda — ex. o usuário trocou de família no
  // meio da edição), o campo se ajusta sozinho pro valor que o servidor
  // vai aplicar de qualquer forma, em vez de mostrar um valor que será
  // silenciosamente ignorado ao salvar.
  useEffect(() => {
    if (travado && travada !== value) onChange(travada);
    // Só reage à trava mudando, não a toda tecla digitada em value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travada]);

  return (
    <label className="text-xs font-medium text-slate-600">
      unit of measurement
      <input
        value={value}
        disabled={travado}
        onChange={(e) => onChange(e.target.value)}
        placeholder="g, kg, ml, L, un…"
        className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-2 text-base disabled:bg-slate-50 disabled:text-slate-500 sm:min-h-9 sm:text-sm"
      />
      {travado ? (
        <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
          locked by family — change in{" "}
          <Link
            href="/configuracoes/familias"
            className="text-blue-600 hover:text-blue-700"
          >
            settings &gt; families
          </Link>
        </span>
      ) : (
        travada === null &&
        productFamily.trim() !== "" && (
          <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
            first product in this family — this locks it for the whole family
          </span>
        )
      )}
    </label>
  );
}
