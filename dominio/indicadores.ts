/*
 * Faturado em 12 meses, sua evolução e a variação (docs/plano.md, "Telas" e "Baixo volume").
 */

/** Com menos que isso nos 12 meses anteriores, a variação vira "dados insuficientes". */
const BASE_MINIMA_DA_VARIACAO = 2_000;
const PONTOS_DA_EVOLUCAO = 13;

/**
 * O faturado em 12 meses no fim de cada um dos 13 últimos meses fechados, do mais antigo ao mais
 * recente. Recebe o faturado dos meses fechados, também do mais antigo ao mais recente (24 ou mais).
 */
export function evolucao12m(mesesFechados: readonly number[]): number[] {
  const total = mesesFechados.length;
  return Array.from({ length: PONTOS_DA_EVOLUCAO }, (_, i) => {
    const fim = total - PONTOS_DA_EVOLUCAO + i;
    return somar(mesesFechados.slice(Math.max(0, fim - 11), fim + 1));
  });
}

/** Os últimos 12 meses contra os 12 anteriores: o último ponto da evolução ÷ o primeiro − 1. */
export function variacao12m(evolucao: readonly number[]): number | null {
  const base = evolucao[0] ?? 0;
  const atual = evolucao.at(-1) ?? 0;
  return base >= BASE_MINIMA_DA_VARIACAO ? atual / base - 1 : null;
}

function somar(valores: readonly number[]): number {
  return valores.reduce((soma, valor) => soma + valor, 0);
}
