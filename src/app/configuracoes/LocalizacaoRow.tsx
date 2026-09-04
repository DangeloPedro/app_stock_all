"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Localizacao } from "@prisma/client";

export function LocalizacaoRow({ localizacao }: { localizacao: Localizacao }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(localizacao.nome);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function atualizar(data: Record<string, unknown>) {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/localizacoes/${localizacao.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErro(body?.error ? JSON.stringify(body.error) : "error saving");
        return;
      }
      setEditando(false);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <li className="flex flex-col items-stretch gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      {editando ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            atualizar({ nome });
          }}
          className="flex flex-1 flex-wrap items-center gap-2"
        >
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="min-h-11 flex-1 rounded-md border border-slate-300 px-2 text-base sm:min-h-9 sm:text-sm"
          />
          <button
            type="submit"
            disabled={salvando}
            className="min-h-11 rounded-md bg-slate-900 px-3 text-xs font-medium text-white sm:min-h-9"
          >
            save
          </button>
          <button
            type="button"
            onClick={() => {
              setNome(localizacao.nome);
              setEditando(false);
            }}
            className="min-h-11 rounded-md px-3 text-xs font-medium text-slate-500 hover:bg-slate-100 sm:min-h-9"
          >
            cancel
          </button>
        </form>
      ) : (
        <>
          <span
            className={`font-medium ${localizacao.ativo ? "text-slate-900" : "text-slate-400 line-through"}`}
          >
            {localizacao.nome}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setEditando(true)}
              className="min-h-11 rounded-md px-3 text-xs font-medium text-slate-500 hover:bg-slate-100 sm:min-h-9"
            >
              rename
            </button>
            <button
              disabled={salvando}
              onClick={() => atualizar({ ativo: !localizacao.ativo })}
              className={
                localizacao.ativo
                  ? "min-h-11 rounded-md bg-amber-50 px-3 text-xs font-medium text-amber-700 hover:bg-amber-100 sm:min-h-9"
                  : "min-h-11 rounded-md bg-emerald-50 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-100 sm:min-h-9"
              }
            >
              {localizacao.ativo ? "deactivate" : "reactivate"}
            </button>
          </div>
        </>
      )}
      {erro && <p role="status" className="text-xs text-red-600">{erro}</p>}
    </li>
  );
}
