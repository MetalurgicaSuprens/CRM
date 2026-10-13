import type { Mercado, OportunidadeMix, Porte } from "./tipos.ts";

/** O que a regra de mix precisa saber de cada cliente da Suprens. */
export type ClienteNoMix = {
  codigo: string;
  mercado: Mercado;
  faturamento12m: number;
  /** Famílias compradas nos últimos 12 meses. */
  familias12m: ReadonlySet<string>;
  /** Famílias compradas nos últimos 24 meses. */
  familias24m: ReadonlySet<string>;
};

export type SugestaoDeMix = {
  /** null quando a faixa de porte tinha menos de 20 clientes e a comparação usou o mercado inteiro. */
  porte: Porte | null;
  oportunidades: OportunidadeMix[];
};

const MINIMO_DE_PARECIDOS = 20;
const PARCELA_MINIMA = 0.5;

/**
 * Regra do plano (docs/plano.md, "Mix"). Os parecidos são os outros clientes ativos (com compra
 * em 12 meses) de toda a Suprens, do mesmo mercado e da mesma faixa de porte; com menos de 20 na
 * faixa, o mercado inteiro; com menos de 20 no mercado, não há com quem comparar (null).
 * Sugere as famílias que pelo menos metade deles comprou em 12 meses e que o cliente não compra
 * há 24, da mais comum para a menos comum.
 */
export function sugerirMix(cliente: ClienteNoMix, todos: readonly ClienteNoMix[]): SugestaoDeMix | null {
  const ativosDoMercado = todos.filter((outro) => outro.mercado === cliente.mercado && outro.faturamento12m > 0);
  const porteDe = classificadorDePorte(ativosDoMercado.map((outro) => outro.faturamento12m));
  const porte = porteDe(cliente.faturamento12m);
  const doMercado = ativosDoMercado.filter((outro) => outro.codigo !== cliente.codigo);
  const daFaixa = doMercado.filter((outro) => porteDe(outro.faturamento12m) === porte);
  if (daFaixa.length >= MINIMO_DE_PARECIDOS) return { porte, oportunidades: familiasQueFaltam(cliente, daFaixa) };
  if (doMercado.length >= MINIMO_DE_PARECIDOS) return { porte: null, oportunidades: familiasQueFaltam(cliente, doMercado) };
  return null;
}

/** Tercis do faturado em 12 meses dentro do mercado. */
function classificadorDePorte(faturamentos: number[]): (faturamento: number) => Porte {
  const ordenados = [...faturamentos].sort((a, b) => a - b);
  const limitePequeno = quantil(ordenados, 1 / 3);
  const limiteMedio = quantil(ordenados, 2 / 3);
  return (faturamento) => (faturamento <= limitePequeno ? "pequeno" : faturamento <= limiteMedio ? "medio" : "grande");
}

function quantil(ordenados: number[], fracao: number): number {
  return ordenados[Math.floor((ordenados.length - 1) * fracao)] ?? 0;
}

function familiasQueFaltam(cliente: ClienteNoMix, parecidos: ClienteNoMix[]): OportunidadeMix[] {
  const familias = new Set(parecidos.flatMap((outro) => [...outro.familias12m]));
  return [...familias]
    .filter((familia) => !cliente.familias24m.has(familia))
    .map((familia) => ({
      familia,
      penetracao: parecidos.filter((outro) => outro.familias12m.has(familia)).length / parecidos.length,
    }))
    .filter((oportunidade) => oportunidade.penetracao >= PARCELA_MINIMA)
    .sort((a, b) => b.penetracao - a.penetracao || a.familia.localeCompare(b.familia));
}
