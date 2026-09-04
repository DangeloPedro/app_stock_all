"use client";

import { useEffect, useState } from "react";

/// Unidade travada da família (ver FamiliaUnidade no schema e
/// lib/familias.ts). Usado por NovoProdutoForm e o EditForm de ProdutoCard
/// pra desabilitar o campo "unit of measurement" assim que a família já tem
/// dona — o servidor reforça a mesma trava independente disto (ver POST/PATCH
/// /api/produtos), então isto é só UX, não a fonte de verdade.
///
/// undefined = ainda sem família escolhida (nada a consultar).
/// null      = família livre — o campo pode ser digitado, e o valor
///             digitado é o que vai travá-la.
/// string    = travada nesse valor.
export function useFamiliaUnidade(productFamily: string) {
  const [unidade, setUnidade] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const nome = productFamily.trim();
    if (!nome) {
      setUnidade(undefined);
      return;
    }
    let cancelado = false;
    fetch(`/api/produtos/familias/unidade?nome=${encodeURIComponent(nome)}`)
      .then((r) => (r.ok ? r.json() : { unidadeDeMedida: null }))
      .then((data) => {
        if (!cancelado) setUnidade(data.unidadeDeMedida);
      })
      .catch(() => {
        if (!cancelado) setUnidade(null);
      });
    return () => {
      cancelado = true;
    };
  }, [productFamily]);

  return unidade;
}
