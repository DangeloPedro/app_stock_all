"use client";

import { useEffect, useId, useState } from "react";

// Autocomplete sobre os valores de productFamily já existentes — não impede
// digitar um valor novo, mas facilita reusar o que já existe em vez de
// fragmentar famílias sem querer (docs/revisao-modelo-dados.md, achado 2.2).
export function FamilyInput({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const listId = useId();
  const [familias, setFamilias] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/produtos/familias")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setFamilias)
      .catch(() => setFamilias([]));
  }, []);

  return (
    <>
      <input
        list={listId}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g.: yogurt, olive oil…"
        className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-2 text-base sm:min-h-9 sm:text-sm"
      />
      <datalist id={listId}>
        {familias.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </>
  );
}
