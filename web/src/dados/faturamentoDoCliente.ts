import { somarMeses } from "dominio/datas";
import type { BarraMensal } from "../graficos/BarrasMensais";
import type { FaturamentoMensal, PedidoDaFicha } from "./tipos";

/*
 * Os gráficos de faturamento da ficha. A tendência cobre os últimos 4 anos em duas vistas: o
 * faturado nos 12 meses até cada mês, que tira a sazonalidade e o vaivém dos pedidos (o último ponto é
 * o "Faturado em 12 meses" do alto da ficha), e o faturado de cada mês. O mês a mês é o ano corrente
 * contra o anterior, como no Início.
 */

/** A tendência cobre os últimos 4 anos. */
const MESES_DA_TENDENCIA = 48;
const MESES_DO_ANO = 12;

type HistoriaPorMes = ReadonlyMap<string, FaturamentoMensal>;

export type PontoDaTendencia = {
  /** O mês em que os 12 meses terminam ("2026-09"). */
  mes: string;
  /** O faturado nos 12 meses até o mês, inclusive. */
  valor: number;
  /** O mesmo, 12 meses antes; null quando a história não alcança. */
  anoAntes: number | null;
};

/** Um ponto por mês fechado, dos últimos 48; o ponto sem 12 meses de história fica de fora. */
export function montarTendencia(mensal: readonly FaturamentoMensal[], mesAtual: string): PontoDaTendencia[] {
  const historia = porMes(mensal);
  return mesesDaTendencia(mesAtual).flatMap((mes) => {
    const valor = somarOsDozeMeses(historia, mes);
    return valor === null ? [] : [{ mes, valor, anoAntes: somarOsDozeMeses(historia, somarMeses(mes, -MESES_DO_ANO)) }];
  });
}

/** De quando a tendência parte e quanto ela andou do primeiro ponto ao último; null sem dois pontos. */
export function resumirATendencia(pontos: readonly PontoDaTendencia[]): { desde: string; variacao: number | null } | null {
  const [primeiro] = pontos;
  const ultimo = pontos.at(-1);
  if (!primeiro || !ultimo || primeiro === ultimo) return null;
  return { desde: primeiro.mes, variacao: primeiro.valor > 0 ? ultimo.valor / primeiro.valor - 1 : null };
}

/** O faturado de cada um dos mesmos 48 meses da tendência; o mês que a história não alcança fica de fora. */
export function montarFaturadoPorMes(mensal: readonly FaturamentoMensal[], mesAtual: string): BarraMensal[] {
  const historia = porMes(mensal);
  return mesesDaTendencia(mesAtual).flatMap((mes) => {
    const doMes = historia.get(mes);
    return doMes ? [{ mes, valor: doMes.valor }] : [];
  });
}

/** Os 12 meses do ano corrente, com o mesmo mês do ano anterior e, no mês corrente, o que falta faturar. */
export function montarMesAMes(mensal: readonly FaturamentoMensal[], mesAtual: string, aFaturar: number): BarraMensal[] {
  const historia = porMes(mensal);
  return mesesDe(`${mesAtual.slice(0, 4)}-01`, `${mesAtual.slice(0, 4)}-12`).map((mes) => ({
    mes,
    valor: mes <= mesAtual ? (historia.get(mes)?.valor ?? 0) : null,
    comparacao: historia.get(somarMeses(mes, -MESES_DO_ANO))?.valor ?? null,
    aFaturar: mes === mesAtual ? aFaturar : null,
  }));
}

/** O saldo dos pedidos em aberto com entrega até o fim do mês corrente, os atrasados também, como no Início. */
export function aFaturarNoMes(pedidos: readonly PedidoDaFicha[], mesAtual: string): number {
  return pedidos
    .filter(({ status }) => status === "em_aberto")
    .flatMap(({ itens }) => itens)
    .filter(({ entrega }) => entrega !== null && entrega.slice(0, 7) <= mesAtual)
    .reduce((soma, { valor }) => soma + valor, 0);
}

export type ResumoDoAno = { inicio: string; fim: string; valor: number; anoAnterior: number };

/** Os meses fechados do ano corrente contra os mesmos do ano anterior; null em janeiro, ainda sem mês fechado. */
export function resumirOAno(mensal: readonly FaturamentoMensal[], mesAtual: string): ResumoDoAno | null {
  const inicio = `${mesAtual.slice(0, 4)}-01`;
  const fim = somarMeses(mesAtual, -1);
  if (fim < inicio) return null;
  const historia = porMes(mensal);
  const somarDe = (primeiro: string, ultimo: string) => mesesDe(primeiro, ultimo).reduce((soma, mes) => soma + (historia.get(mes)?.valor ?? 0), 0);
  return { inicio, fim, valor: somarDe(inicio, fim), anoAnterior: somarDe(somarMeses(inicio, -MESES_DO_ANO), somarMeses(fim, -MESES_DO_ANO)) };
}

/** Os 48 meses fechados até o mês passado. */
function mesesDaTendencia(mesAtual: string): string[] {
  return mesesDe(somarMeses(mesAtual, -MESES_DA_TENDENCIA), somarMeses(mesAtual, -1));
}

function porMes(mensal: readonly FaturamentoMensal[]): HistoriaPorMes {
  return new Map(mensal.map((mes) => [mes.mes, mes]));
}

/** De `inicio` a `fim`, inclusive ("2026-01" a "2026-03": jan, fev e mar). */
function mesesDe(inicio: string, fim: string): string[] {
  const meses: string[] = [];
  for (let mes = inicio; mes <= fim; mes = somarMeses(mes, 1)) meses.push(mes);
  return meses;
}

/** A soma dos 12 meses até `fim`, inclusive; null se algum deles não está na história. */
function somarOsDozeMeses(historia: HistoriaPorMes, fim: string): number | null {
  let soma = 0;
  for (const mes of mesesDe(somarMeses(fim, 1 - MESES_DO_ANO), fim)) {
    const doMes = historia.get(mes);
    if (!doMes) return null;
    soma += doMes.valor;
  }
  return soma;
}
