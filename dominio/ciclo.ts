import { diasEntre } from "./datas.ts";

/*
 * Compras e ciclo típico (docs/plano.md, "Evento de compra" e "Ciclo típico").
 */

const DIAS_DE_UMA_COMPRA = 7;
const COMPRAS_PARA_O_CICLO = 4;
const DIAS_DA_JANELA_DO_CICLO = 730;
const CICLO_MINIMO = 30;
const CICLO_MAXIMO = 180;

/**
 * As compras do cliente a partir das datas das notas, em ordem: cada compra começa numa nota e
 * junta as notas dos 7 dias seguintes. Devolve a data da primeira nota de cada compra.
 */
export function comprasDasNotas(datasDasNotas: readonly string[]): string[] {
  const compras: string[] = [];
  for (const data of datasDasNotas) {
    const inicio = compras.at(-1);
    if (inicio === undefined || diasEntre(inicio, data) > DIAS_DE_UMA_COMPRA) compras.push(data);
  }
  return compras;
}

/**
 * Mediana dos dias entre as compras dos últimos 24 meses. null (cliente irregular) com menos de
 * 4 compras ou com a mediana fora de 30 a 180 dias.
 */
export function cicloTipico(compras: readonly string[], hoje: string): number | null {
  const recentes = compras.filter((data) => diasEntre(data, hoje) <= DIAS_DA_JANELA_DO_CICLO);
  if (recentes.length < COMPRAS_PARA_O_CICLO) return null;
  const intervalos = recentes.slice(1).map((data, i) => diasEntre(recentes[i] ?? data, data));
  const ciclo = Math.round(mediana(intervalos));
  return ciclo >= CICLO_MINIMO && ciclo <= CICLO_MAXIMO ? ciclo : null;
}

function mediana(valores: readonly number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const centro = ordenados[meio] ?? 0;
  return ordenados.length % 2 ? centro : ((ordenados[meio - 1] ?? centro) + centro) / 2;
}
