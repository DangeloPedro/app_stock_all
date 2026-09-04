"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type FamiliaComContagem = {
  nome: string;
  quantidade: number;
  // null = ainda livre — nenhum produto travou uma unidade pra essa família.
  unidadeDeMedida: string | null;
};

// Diferente de LojaRow/LocalizacaoRow: família não é uma entidade com id
// própria, é texto livre em Produto (ver docs/revisao-modelo-dados.md).
// Renomear aqui dispara um bulk update em todos os produtos com esse nome —
// e renomear pra um nome que já existe funciona como merge (junta as duas).
export function FamiliaRow({ familia }: { familia: FamiliaComContagem }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(familia.nome);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [editandoUnidade, setEditandoUnidade] = useState(false);
  const [unidade, setUnidade] = useState(familia.unidadeDeMedida ?? "");
  const [salvandoUnidade, setSalvandoUnidade] = useState(false);
  const [erroUnidade, setErroUnidade] = useState<string | null>(null);

  async function renomear(e: React.FormEvent) {
    e.preventDefault();
    if (nome.trim() === familia.nome) {
      setEditando(false);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/produtos/familias", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ de: familia.nome, para: nome }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErro(body?.error ? JSON.stringify(body.error) : "error renaming");
        return;
      }
      setEditando(false);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  // valorNovo "" destrava a família (produtos já cadastrados mantêm o que já
  // tinham); qualquer outro valor trava/retrava e propaga pra TODO produto
  // já cadastrado nela, não só os futuros.
  async function salvarUnidade(valorNovo: string) {
    setSalvandoUnidade(true);
    setErroUnidade(null);
    try {
      const res = await fetch("/api/produtos/familias/unidade", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: familia.nome, unidadeDeMedida: valorNovo }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErroUnidade(body?.error ? JSON.stringify(body.error) : "error saving");
        return;
      }
      setEditandoUnidade(false);
      router.refresh();
    } finally {
      setSalvandoUnidade(false);
    }
  }

  async function excluir() {
    setExcluindo(true);
    setErro(null);
    try {
      const res = await fetch("/api/produtos/familias", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: familia.nome }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErro(body?.error ? JSON.stringify(body.error) : "error deleting");
        return;
      }
      router.refresh();
    } finally {
      setExcluindo(false);
      setConfirmandoExclusao(false);
    }
  }

  return (
    <li className="flex flex-col items-stretch gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      {editando ? (
        <form onSubmit={renomear} className="flex flex-1 flex-wrap items-center gap-2">
          <input
            value={nome}
            required
            autoFocus
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
              setNome(familia.nome);
              setEditando(false);
              setErro(null);
            }}
            className="min-h-11 rounded-md px-3 text-xs font-medium text-slate-500 hover:bg-slate-100 sm:min-h-9"
          >
            cancel
          </button>
        </form>
      ) : confirmandoExclusao ? (
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <span className="text-sm text-slate-700">
            delete "{familia.nome}"? its {familia.quantidade} product
            {familia.quantidade === 1 ? "" : "s"} will be kept, just left
            without a family.
          </span>
          <button
            onClick={excluir}
            disabled={excluindo}
            className="min-h-11 rounded-md bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700 sm:min-h-9"
          >
            {excluindo ? "deleting…" : "confirm delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmandoExclusao(false)}
            className="min-h-11 rounded-md px-3 text-xs font-medium text-slate-500 hover:bg-slate-100 sm:min-h-9"
          >
            cancel
          </button>
        </div>
      ) : (
        <>
          <div>
            <span className="font-medium text-slate-900">
              {familia.nome}{" "}
              <span className="font-normal text-slate-400">
                ({familia.quantidade} product{familia.quantidade === 1 ? "" : "s"})
              </span>
            </span>
            <div className="mt-1">
              {editandoUnidade ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    salvarUnidade(unidade.trim());
                  }}
                  className="flex flex-wrap items-center gap-1.5"
                >
                  <input
                    value={unidade}
                    autoFocus
                    placeholder="g, kg, ml, L, un…"
                    onChange={(e) => setUnidade(e.target.value)}
                    className="min-h-9 w-32 rounded-md border border-slate-300 px-1.5 text-sm text-slate-900"
                  />
                  <button
                    type="submit"
                    disabled={salvandoUnidade}
                    className="min-h-9 rounded-md bg-slate-900 px-2.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    save
                  </button>
                  {familia.unidadeDeMedida !== null && (
                    <button
                      type="button"
                      disabled={salvandoUnidade}
                      onClick={() => salvarUnidade("")}
                      className="min-h-9 rounded-md px-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      clear lock
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={salvandoUnidade}
                    onClick={() => {
                      setUnidade(familia.unidadeDeMedida ?? "");
                      setEditandoUnidade(false);
                      setErroUnidade(null);
                    }}
                    className="min-h-9 px-1 text-xs text-slate-400 hover:text-slate-600"
                  >
                    cancel
                  </button>
                  <span className="basis-full text-[11px] text-slate-400">
                    changes the unit on all {familia.quantidade} product
                    {familia.quantidade === 1 ? "" : "s"} in this family
                  </span>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditandoUnidade(true)}
                  className="min-h-9 text-xs text-slate-400 hover:text-slate-600"
                >
                  {familia.unidadeDeMedida !== null ? (
                    <>
                      unit locked:{" "}
                      <span className="font-medium text-slate-600">
                        {familia.unidadeDeMedida}
                      </span>
                    </>
                  ) : (
                    "no unit locked yet"
                  )}
                </button>
              )}
              {erroUnidade && (
                <p role="status" className="text-xs text-red-600">
                  {erroUnidade}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditando(true)}
              className="min-h-11 rounded-md px-3 text-xs font-medium text-slate-500 hover:bg-slate-100 sm:min-h-9"
            >
              rename
            </button>
            <button
              onClick={() => setConfirmandoExclusao(true)}
              className="min-h-11 rounded-md px-3 text-xs font-medium text-red-600 hover:bg-red-50 sm:min-h-9"
            >
              delete
            </button>
          </div>
        </>
      )}
      {erro && <p role="status" className="text-xs text-red-600">{erro}</p>}
    </li>
  );
}
