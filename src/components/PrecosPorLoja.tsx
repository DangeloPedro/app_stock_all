"use client";

import { useState } from "react";
import { simboloMoeda, formatMoeda } from "@/lib/moeda";
import { useMoeda } from "@/components/MoedaContext";

type PrecoLoja = { lojaId: string; lojaNome: string; preco: number | null };

// Preço de referência por mercado — pra planejar em qual mercado ir ANTES de
// comprar. Sempre editável (diferente do preço realmente pago, que só o
// histórico registra). Autocontido: o próprio botão "preços" abre/fecha e
// busca os dados só na primeira vez.
export function PrecosPorLoja({
  produtoId,
  unidadeDeMedida = null,
  conteudoEmbalagem = null,
}: {
  produtoId: string;
  // Com os dois preenchidos, cada linha também mostra o preço por unidade
  // (ex. preço/g) — sem eles, só o preço por embalagem de sempre.
  unidadeDeMedida?: string | null;
  conteudoEmbalagem?: number | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [precos, setPrecos] = useState<PrecoLoja[]>([]);

  async function abrir() {
    const proximo = !aberto;
    setAberto(proximo);
    if (proximo && !carregado) {
      setCarregando(true);
      setErro(null);
      try {
        const res = await fetch(`/api/produtos/${produtoId}/precos`);
        if (!res.ok) throw new Error("failed to load prices");
        setPrecos(await res.json());
        setCarregado(true);
      } catch {
        // Sem isto, uma falha de rede (ex.: servidor de dev fora do ar no
        // meio da requisição) deixava "carregando…" preso pra sempre — nada
        // mais reagia porque nenhum estado era atualizado depois do throw.
        setErro("could not load. click again to retry.");
      } finally {
        setCarregando(false);
      }
    }
  }

  async function salvar(lojaId: string, preco: number) {
    setPrecos((prev) =>
      prev.map((p) => (p.lojaId === lojaId ? { ...p, preco } : p)),
    );
    await fetch(`/api/produtos/${produtoId}/precos`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lojaId, preco }),
    });
  }

  return (
    // O pai (ProdutoCard/ItemLista) empilha isto num flex-wrap junto com
    // outros botões (AcabouButton, "edit"). Fechado, isto é só um botão
    // estreito e convive bem na mesma linha. Aberto, o painel de preços
    // cresce em altura — sem w-full aqui, os botões vizinhos ficavam
    // centralizados verticalmente nessa linha agora alta (items-center do
    // pai) e pareciam atravessar o painel. w-full força quebra de linha só
    // quando expandido, sem mudar nada no estado fechado.
    <div className={aberto ? "w-full" : undefined}>
      <button
        type="button"
        onClick={abrir}
        className="min-h-11 rounded-md px-3 text-xs font-medium text-slate-500 hover:bg-slate-100 active:bg-slate-200"
      >
        {aberto ? "close prices" : "prices by store"}
      </button>

      {aberto && (
        <ul className="mt-2 space-y-1 rounded-md border border-slate-200 bg-slate-50 p-2">
          {carregando && (
            <li className="text-xs text-slate-400">loading…</li>
          )}
          {erro && <li className="text-xs text-red-600">{erro}</li>}
          {!carregando && !erro && precos.length === 0 && (
            <li className="text-xs text-slate-400">no store added yet</li>
          )}
          {precos.map((p) => (
            <PrecoRow
              key={p.lojaId}
              preco={p}
              onSalvar={salvar}
              unidadeDeMedida={unidadeDeMedida}
              conteudoEmbalagem={conteudoEmbalagem}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PrecoRow({
  preco,
  onSalvar,
  unidadeDeMedida,
  conteudoEmbalagem,
}: {
  preco: PrecoLoja;
  onSalvar: (lojaId: string, preco: number) => void;
  unidadeDeMedida: string | null;
  conteudoEmbalagem: number | null;
}) {
  const moeda = useMoeda();
  const [valor, setValor] = useState(
    preco.preco !== null ? String(preco.preco) : "",
  );

  function commitar() {
    const numero = Number(valor);
    if (!valor || !Number.isFinite(numero) || numero <= 0) return;
    if (numero === preco.preco) return;
    onSalvar(preco.lojaId, numero);
  }

  const numeroAtual = Number(valor);
  const precoPorUnidade =
    unidadeDeMedida &&
    conteudoEmbalagem &&
    valor &&
    Number.isFinite(numeroAtual) &&
    numeroAtual > 0
      ? numeroAtual / conteudoEmbalagem
      : null;

  return (
    <li className="flex items-center justify-between gap-2 text-xs text-slate-600">
      <span>{preco.lojaNome}</span>
      <span className="flex flex-col items-end gap-0.5">
        <span className="flex items-center gap-1">
          <span className="text-slate-400">{simboloMoeda(moeda)}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={valor}
            placeholder="—"
            onChange={(e) => setValor(e.target.value)}
            onBlur={commitar}
            className="min-h-10 w-20 rounded-md border border-slate-300 px-1.5 text-sm text-slate-900"
          />
          <span className="text-slate-400">/unit</span>
        </span>
        {precoPorUnidade !== null && (
          <span className="text-[11px] text-slate-400">
            ≈ {formatMoeda(precoPorUnidade, moeda)}/{unidadeDeMedida}
          </span>
        )}
      </span>
    </li>
  );
}
