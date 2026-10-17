import { somarMeses } from "dominio/datas";
import type { FaturamentoMensal } from "./tipos";

/*
 * As barras do gráfico de faturamento da ficha: os 12, 24 ou 48 meses fechados e o corrente, por mês,
 * por trimestre ou por ano, com a média móvel de 12 meses. Trimestre e ano são os do calendário: o
 * primeiro começa no início dele, mesmo antes do período, para nenhuma barra fechada vir cortada.
 */

export type Periodo = 12 | 24 | 48;
export type Resolucao = "mensal" | "trimestral" | "anual";

export const MESES_POR_BARRA: Readonly<Record<Resolucao, number>> = { mensal: 1, trimestral: 3, anual: 12 };
const MESES_DA_MEDIA = 12;

export type BarraDoFaturamento = {
  /** O primeiro mês da barra ("2026-07"). */
  mes: string;
  valor: number;
  /**
   * A média mensal dos 12 meses fechados até o último mês fechado da barra, inclusive, vezes os meses
   * da barra: na barra de janeiro de 2024, a média de fevereiro de 2023 a janeiro de 2024. Assim, a
   * linha fica na escala das barras. Null sem os 12 meses na história e na barra sem mês fechado, o
   * mês corrente.
   */
  media: number | null;
  /** A barra do período corrente, que ainda não fechou. */
  isCorrente: boolean;
};

export function montarSerieDoFaturamento(
  mensal: readonly FaturamentoMensal[],
  mesAtual: string,
  { periodo, resolucao }: { periodo: Periodo; resolucao: Resolucao },
): BarraDoFaturamento[] {
  const valorDoMes = new Map(mensal.map(({ mes, valor }) => [mes, valor]));
  const tamanho = MESES_POR_BARRA[resolucao];
  const ultimoFechado = somarMeses(mesAtual, -1);
  const barras: BarraDoFaturamento[] = [];
  for (let inicio = inicioDaBarra(somarMeses(mesAtual, -periodo), resolucao); inicio <= mesAtual; inicio = somarMeses(inicio, tamanho)) {
    const meses = mesesDesde(inicio, tamanho).filter((mes) => mes <= mesAtual);
    const isCorrente = meses.includes(mesAtual);
    // A barra fechada sem todos os meses na história fica de fora (a carteira fictícia tem 36 meses).
    if (!isCorrente && !meses.every((mes) => valorDoMes.has(mes))) continue;
    const ultimoMesFechado = meses.filter((mes) => mes <= ultimoFechado).at(-1);
    barras.push({
      mes: inicio,
      valor: somar(meses.map((mes) => valorDoMes.get(mes) ?? 0)),
      media: ultimoMesFechado ? mediaMovel(valorDoMes, ultimoMesFechado, tamanho) : null,
      isCorrente,
    });
  }
  return barras;
}

/** A média mensal dos 12 meses até `fim`, inclusive, vezes os meses da barra; null se falta algum mês. */
function mediaMovel(valorDoMes: ReadonlyMap<string, number>, fim: string, mesesDaBarra: number): number | null {
  const meses = mesesDesde(somarMeses(fim, -(MESES_DA_MEDIA - 1)), MESES_DA_MEDIA);
  if (!meses.every((mes) => valorDoMes.has(mes))) return null;
  return (somar(meses.map((mes) => valorDoMes.get(mes) ?? 0)) / MESES_DA_MEDIA) * mesesDaBarra;
}

/** O primeiro mês da barra do mês: ele mesmo, o primeiro do trimestre ou janeiro. */
function inicioDaBarra(mes: string, resolucao: Resolucao): string {
  const ano = mes.slice(0, 4);
  const numero = Number(mes.slice(5, 7));
  if (resolucao === "mensal") return mes;
  if (resolucao === "anual") return `${ano}-01`;
  return `${ano}-${String(numero - ((numero - 1) % 3)).padStart(2, "0")}`;
}

function mesesDesde(inicio: string, quantidade: number): string[] {
  return Array.from({ length: quantidade }, (_, i) => somarMeses(inicio, i));
}

function somar(valores: readonly number[]): number {
  return valores.reduce((soma, valor) => soma + valor, 0);
}
