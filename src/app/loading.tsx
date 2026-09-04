// Loading boundary compartilhado por toda rota — Next.js mostra isso
// automaticamente enquanto o Server Component da página busca dados.
// Placeholders neutros (sem skeleton animado nem shimmer, propositalmente
// simples pra um app pessoal), só pra evitar a tela em branco.
export default function Loading() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
        />
      ))}
    </div>
  );
}
