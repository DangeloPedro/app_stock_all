"use client";

import { useEffect, useState } from "react";
import type { Localizacao } from "@prisma/client";

// <select> de localização em casa, alimentado pela tabela Localizacao
// (editável em /configuracoes/locais) — nunca uma lista fixa no código.
export function LocalizacaoSelect({
  value,
  onChange,
  allowEmpty = true,
}: {
  value: string;
  onChange: (localizacaoId: string) => void;
  allowEmpty?: boolean;
}) {
  const [localizacoes, setLocalizacoes] = useState<Localizacao[]>([]);
  // Distinto de "localizacoes.length === 0" de propósito — sem isto, uma
  // falha de fetch virava silenciosamente "nenhum local cadastrado",
  // indistinguível da base estar vazia de verdade (mesmo raciocínio do
  // LojaSelect).
  const [erro, setErro] = useState(false);

  useEffect(() => {
    fetch("/api/localizacoes?ativo=true")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setLocalizacoes)
      .catch(() => setErro(true));
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-2 text-base sm:min-h-9 sm:text-sm"
    >
      {erro && (
        <option value="">couldn&apos;t load locations — reload page</option>
      )}
      {!erro && allowEmpty && <option value="">no location set</option>}
      {localizacoes.map((loc) => (
        <option key={loc.id} value={loc.id}>
          {loc.nome}
        </option>
      ))}
    </select>
  );
}
