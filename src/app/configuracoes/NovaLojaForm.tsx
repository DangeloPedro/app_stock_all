"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NovaLojaForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/lojas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErro(body?.error ? JSON.stringify(body.error) : "error creating store");
        return;
      }
      setNome("");
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={criar} className="flex gap-2">
      <input
        value={nome}
        required
        onChange={(e) => setNome(e.target.value)}
        placeholder="new store name…"
        className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 text-base sm:min-h-9 sm:text-sm"
      />
      <button
        type="submit"
        disabled={enviando}
        className="min-h-11 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 sm:min-h-9"
      >
        {enviando ? "creating…" : "+ add"}
      </button>
      {erro && <p role="status" className="text-xs text-red-600">{erro}</p>}
    </form>
  );
}
