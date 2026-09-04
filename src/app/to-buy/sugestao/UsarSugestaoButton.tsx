"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UsarSugestaoButton({
  atribuicoes,
}: {
  atribuicoes: { produtoId: string; lojaId: string }[];
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);

  async function aplicar() {
    setEnviando(true);
    try {
      await Promise.all(
        atribuicoes.map((a) =>
          fetch(`/api/produtos/${a.produtoId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lojaPreferidaId: a.lojaId }),
          }),
        ),
      );
      router.push("/to-buy");
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <button
      onClick={aplicar}
      disabled={enviando || atribuicoes.length === 0}
      className="min-h-11 shrink-0 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
    >
      {enviando ? "applying…" : "use this suggestion"}
    </button>
  );
}
