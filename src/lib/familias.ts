import { prisma } from "./prisma";

/// Unidade travada de uma família (null = ainda livre — nenhum produto
/// cadastrado nela decidiu uma unidade ainda). Usado tanto pelo GET que
/// alimenta o client (formulários de produto) quanto, principalmente, pelo
/// POST/PATCH de produto — o client só desabilita o campo, quem garante de
/// verdade é o servidor.
export async function unidadeTravadaDaFamilia(
  nome: string,
): Promise<string | null> {
  if (!nome.trim()) return null;
  const registro = await prisma.familiaUnidade.findUnique({ where: { nome } });
  return registro?.unidadeDeMedida ?? null;
}

/// Decide a unidadeDeMedida final de um produto sendo criado/editado numa
/// família, e tranca a família se for a primeira vez.
///
///   • família já travada → ignora o que veio no request, força a unidade
///     travada (é o que torna o campo "read-only" de verdade, não só na UI).
///   • família ainda livre + unidade fornecida → essa vira a trava da
///     família daqui pra frente (upsert é seguro contra corrida: dois
///     produtos criados ao mesmo tempo na mesma família nova convergem pra
///     quem chegou primeiro no banco, sem erro).
///   • família livre + unidade não fornecida → nada trava ainda, próximo
///     produto que informar uma unidade decide.
export async function aplicarUnidadeDaFamilia(
  productFamily: string | undefined,
  unidadeDeMedida: string | null | undefined,
): Promise<string | null | undefined> {
  if (!productFamily?.trim()) return unidadeDeMedida;

  const travada = await unidadeTravadaDaFamilia(productFamily);
  if (travada !== null) return travada;

  if (unidadeDeMedida) {
    const registro = await prisma.familiaUnidade.upsert({
      where: { nome: productFamily },
      // Duas criações concorrentes na mesma família nova: a que perder a
      // corrida do upsert não sobrescreve — update: {} é um no-op — então o
      // valor devolvido abaixo já é sempre o que realmente ficou gravado,
      // nunca o que essa chamada em particular tentou travar.
      update: {},
      create: { nome: productFamily, unidadeDeMedida },
    });
    return registro.unidadeDeMedida;
  }
  return unidadeDeMedida;
}
