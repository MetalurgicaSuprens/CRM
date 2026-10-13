/*
 * Projeção do faturado do mês (decisão do Lucas em 2026-10-13): o faturado até agora mais o que
 * deve entrar nos dias úteis que faltam, no ritmo dos últimos 6 meses fechados. Na simulação com
 * jan/25 a set/26, esse ritmo errou bem menos que o do próprio mês na primeira quinzena, quando
 * uma nota grande num dia só distorce a média. Os pedidos em carteira com entrega no mês são o
 * piso: se passarem do que o ritmo prevê, valem eles.
 */

/** Meses fechados que formam o ritmo. */
export const MESES_DO_RITMO = 6;

/** De onde vem o que falta faturar no mês. */
export type BaseDaProjecao = "ritmo" | "carteira";

export type Projecao = { valor: number; base: BaseDaProjecao };

export type DadosDaProjecao = {
  faturado: number;
  /** Faturado por dia útil nos últimos 6 meses fechados. */
  ritmoPorDiaUtil: number;
  diasUteisRestantes: number;
  /** Pedidos em carteira com entrega até o fim do mês. */
  aFaturarNoMes: number;
};

export function projetarMes({ faturado, ritmoPorDiaUtil, diasUteisRestantes, aFaturarNoMes }: DadosDaProjecao): Projecao {
  const peloRitmo = ritmoPorDiaUtil * Math.max(0, diasUteisRestantes);
  return aFaturarNoMes > peloRitmo
    ? { valor: faturado + aFaturarNoMes, base: "carteira" }
    : { valor: faturado + peloRitmo, base: "ritmo" };
}
