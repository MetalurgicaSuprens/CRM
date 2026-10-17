import { somarMeses } from "dominio/datas";
import type { BarraMensal } from "../graficos/BarrasMensais";
import type { FaturamentoMensal, PedidoDaFicha } from "./tipos";

/*
 * Os dois gráficos de faturamento da ficha. A tendência é o faturado nos 12 meses até cada mês: tira
 * a sazonalidade e o vaivém dos pedidos, e o último ponto é o "Faturado em 12 meses" do alto da
 * ficha. O mês a mês é o ano corrente contra o anterior, como no Início.
 */

/** A tendência cobre os últimos 4 anos. */
const MESES_DA_TENDENCIA = 48;
const MESES_DO_ANO = 12;

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
  const valorDoMes = mapaDosMeses(mensal);
  const pontos: PontoDaTendencia[] = [];
  for (let distancia = MESES_DA_TENDENCIA; distancia >= 1; distancia--) {
    const mes = somarMeses(mesAtual, -distancia);
    const valor = somaDosDozeMeses(valorDoMes, mes);
    if (valor !== null) pontos.push({ mes, valor, anoAntes: somaDosDozeMeses(valorDoMes, somarMeses(mes, -MESES_DO_ANO)) });
  }
  return pontos;
}

/** De quando a tendência parte e quanto ela andou do primeiro ponto ao último; null sem dois pontos. */
export function resumirATendencia(pontos: readonly PontoDaTendencia[]): { desde: string; variacao: number | null } | null {
  const [primeiro] = pontos;
  const ultimo = pontos.at(-1);
  if (!primeiro || !ultimo || primeiro === ultimo) return null;
  return { desde: primeiro.mes, variacao: primeiro.valor > 0 ? ultimo.valor / primeiro.valor - 1 : null };
}

/** Os 12 meses do ano corrente, com o mesmo mês do ano anterior e, no mês corrente, o que falta faturar. */
export function montarMesAMes(mensal: readonly FaturamentoMensal[], mesAtual: string, aFaturar: number): BarraMensal[] {
  const valorDoMes = mapaDosMeses(mensal);
  const ano = mesAtual.slice(0, 4);
  return Array.from({ length: MESES_DO_ANO }, (_, i) => {
    const mes = `${ano}-${String(i + 1).padStart(2, "0")}`;
    return {
      mes,
      valor: mes <= mesAtual ? (valorDoMes.get(mes) ?? 0) : null,
      comparacao: valorDoMes.get(somarMeses(mes, -MESES_DO_ANO)) ?? null,
      aFaturar: mes === mesAtual ? aFaturar : null,
    };
  });
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
  const valorDoMes = mapaDosMeses(mensal);
  const somarDe = (primeiro: string, ultimo: string) => {
    let soma = 0;
    for (let mes = primeiro; mes <= ultimo; mes = somarMeses(mes, 1)) soma += valorDoMes.get(mes) ?? 0;
    return soma;
  };
  return { inicio, fim, valor: somarDe(inicio, fim), anoAnterior: somarDe(somarMeses(inicio, -MESES_DO_ANO), somarMeses(fim, -MESES_DO_ANO)) };
}

function mapaDosMeses(mensal: readonly FaturamentoMensal[]): Map<string, number> {
  return new Map(mensal.map(({ mes, valor }) => [mes, valor]));
}

/** A soma dos 12 meses até `fim`, inclusive; null se algum deles não está na história. */
function somaDosDozeMeses(valorDoMes: ReadonlyMap<string, number>, fim: string): number | null {
  let soma = 0;
  for (let distancia = 0; distancia < MESES_DO_ANO; distancia++) {
    const valor = valorDoMes.get(somarMeses(fim, -distancia));
    if (valor === undefined) return null;
    soma += valor;
  }
  return soma;
}
