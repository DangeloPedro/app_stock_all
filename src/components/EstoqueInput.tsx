"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Campo numérico editável inline pra quantidadeEmEstoque — commita no blur,
// só se o valor mudou. Zerar manda o produto pra catalogado (market) — ver
// comentário em commitar().
export function EstoqueInput({
  produtoId,
  valorInicial,
}: {
  produtoId: string;
  valorInicial: number;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(String(valorInicial));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(false);

  async function commitar() {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return;
    // Valor igual ao que já estava não precisa de PATCH — exceto zero: um
    // produto pode estar em_casa COM estoque 0 (dado de antes desta regra
    // existir), e commitar o zero de novo é justamente o que tira ele do
    // shelf. Sem esta exceção, essas linhas ficariam presas pra sempre.
    if (numero === valorInicial && numero !== 0) return;
    setSalvando(true);
    setErro(false);
    try {
      const res = await fetch(`/api/produtos/${produtoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantidadeEmEstoque: numero,
          // Zerar o estoque É o sinal de "acabou" — sai do shelf sozinho,
          // sem precisar do botão "out" (esse continua existindo pra quem
          // já quer decidir loja/quantidade e ir direto pra to-buy).
          ...(numero === 0 ? { status: "catalogado" } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setErro(true);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-500">
      in stock:
      <input
        type="number"
        step="1"
        min="0"
        value={valor}
        disabled={salvando}
        onChange={(e) => setValor(e.target.value)}
        onBlur={commitar}
        className="min-h-11 w-16 rounded-md border border-slate-300 px-1.5 text-base text-slate-900 sm:min-h-9 sm:text-xs"
      />
      {erro && (
        <span role="status" className="text-red-600">
          couldn&apos;t save
        </span>
      )}
    </label>
  );
}
