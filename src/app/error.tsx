"use client";

// Error boundary compartilhado por toda rota — precisa ser Client Component
// (é como o Next.js exige pra error.tsx). Pega erros não tratados na
// renderização de qualquer página; erros de fetch dentro de componentes
// (PATCH, POST, etc.) continuam tratados localmente onde acontecem, isso
// aqui é só a rede de segurança pra quando algo escapa.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-red-300 bg-red-50 p-6 text-center">
      <p className="text-sm font-medium text-red-800">
        something went wrong loading this page.
      </p>
      <p className="max-w-sm text-xs text-red-600">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 active:bg-red-800"
      >
        try again
      </button>
    </div>
  );
}
