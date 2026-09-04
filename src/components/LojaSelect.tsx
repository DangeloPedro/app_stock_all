"use client";

import { useEffect, useState } from "react";
import type { Loja } from "@prisma/client";

// <select> de mercado ativo, alimentado pela tabela Loja (editável em
// /configuracoes) — nunca uma lista fixa no código.
export function LojaSelect({
  value,
  onChange,
  className,
  permitirVazio = false,
}: {
  value: string;
  onChange: (lojaId: string) => void;
  className?: string;
  /// true = mostra uma opção "sem mercado definido" e NÃO auto-seleciona o
  /// primeiro mercado ao carregar (uso: atribuição/planejamento, onde vazio
  /// é um estado válido). false (default) = sempre acaba com algum mercado
  /// selecionado (uso: formulário de fechar compra, que exige uma loja).
  permitirVazio?: boolean;
}) {
  const [lojas, setLojas] = useState<Loja[]>([]);
  // Distinto de "lojas.length === 0" de propósito: sem isto, uma falha de
  // fetch (rede instável, sessão expirada) virava silenciosamente "nenhum
  // mercado cadastrado" — indistinguível de a base estar vazia de verdade.
  // Já vimos isso levar a um diagnóstico errado (parecia que tinha perdido
  // lojas cadastradas quando na verdade era só a requisição falhando).
  const [erro, setErro] = useState(false);

  useEffect(() => {
    fetch("/api/lojas?ativo=true")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: Loja[]) => {
        setLojas(data);
        if (!permitirVazio && !value && data.length > 0) onChange(data[0].id);
      })
      .catch(() => setErro(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        "mt-1 min-h-11 w-full rounded-md border border-slate-300 px-2 text-base sm:min-h-9 sm:text-sm"
      }
    >
      {erro && <option value="">couldn&apos;t load stores — reload page</option>}
      {!erro && lojas.length === 0 && (
        <option value="">no store added yet</option>
      )}
      {!erro && permitirVazio && lojas.length > 0 && (
        <option value="">no store set</option>
      )}
      {lojas.map((loja) => (
        <option key={loja.id} value={loja.id}>
          {loja.nome}
        </option>
      ))}
    </select>
  );
}
