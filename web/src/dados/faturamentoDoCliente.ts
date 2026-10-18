import { somarMeses } from "dominio/datas";
import type { BarraMensal } from "../graficos/BarrasMensais";
import type { BlocoDe12Meses } from "../graficos/BlocosDe12Meses";
import type { AnoAcumulado } from "../graficos/LinhasPorAno";
import type { AnoNoMapa } from "../graficos/MapaDeCalor";
import type { FaturamentoMensal, PedidoDaFicha } from "./tipos";

/*
 * Os gráficos de faturamento da ficha. A tendência cobre os últimos 4 anos e, até o Lucas escolher
 * (pedido de 2026-10-18), tem quatro modelos: os blocos de 12 meses em R$ e em peças, o acumulado de
 * cada ano, o mapa de calor dos meses e a linha do faturado nos 12 meses até cada mês. O mês a mês é
 * o ano corrente contra o anterior, como no Início.
 */

const ANOS_DA_TENDENCIA = 4;
const MESES_DO_ANO = 12;
const MESES_DA_TENDENCIA = ANOS_DA_TENDENCIA * MESES_DO_ANO;

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
  const pontos: PontoDaTendencia[] = [];
  for (let distancia = MESES_DA_TENDENCIA; distancia >= 1; distancia--) {
    const mes = somarMeses(mesAtual, -distancia);
    const valor = somarOsDozeMeses(historia, mes, "valor");
    if (valor !== null) pontos.push({ mes, valor, anoAntes: somarOsDozeMeses(historia, somarMeses(mes, -MESES_DO_ANO), "valor") });
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

/**
 * Os blocos de 12 meses fechados dos últimos 4 anos, do mais antigo ao mais recente: o último termina
 * no mês passado, e cada um começa onde o anterior acaba. O bloco sem a história inteira fica de fora.
 */
export function montarBlocosDe12Meses(mensal: readonly FaturamentoMensal[], mesAtual: string): BlocoDe12Meses[] {
  const historia = porMes(mensal);
  const blocos: BlocoDe12Meses[] = [];
  for (let anos = ANOS_DA_TENDENCIA - 1; anos >= 0; anos--) {
    const fim = somarMeses(mesAtual, -1 - anos * MESES_DO_ANO);
    const valor = somarOsDozeMeses(historia, fim, "valor");
    const pecas = somarOsDozeMeses(historia, fim, "pecas");
    if (valor !== null && pecas !== null) blocos.push({ inicio: somarMeses(fim, 1 - MESES_DO_ANO), fim, valor, pecas });
  }
  return blocos;
}

/** O faturado de cada ano somado de janeiro até cada mês; o ano que a história não cobre inteiro fica de fora. */
export function montarAcumulados(mensal: readonly FaturamentoMensal[], mesAtual: string): AnoAcumulado[] {
  const historia = porMes(mensal);
  return anosDaTendencia(mesAtual).flatMap(({ ano, ultimoMes }) => {
    const doAno = mesesDe(`${ano}-01`, ultimoMes).map((mes) => historia.get(mes));
    if (doAno.some((mes) => mes === undefined)) return [];
    let soma = 0;
    return [{ ano, acumulado: doAno.map((mes) => (soma += mes?.valor ?? 0)) }];
  });
}

export type ComparacaoNoMesmoMes = {
  ano: number;
  /** Até que mês do ano, de 1 a 12. */
  mes: number;
  /** Contra cada ano anterior, do mais recente ao mais antigo; null quando o anterior não tinha faturado. */
  comparacoes: { ano: number; razao: number | null }[];
};

/** O ano mais recente contra cada um dos anteriores, todos somados até o mesmo mês. */
export function compararNoMesmoMes(anos: readonly AnoAcumulado[]): ComparacaoNoMesmoMes | null {
  const recente = anos.at(-1);
  const ate = recente?.acumulado.length ?? 0;
  if (!recente || ate === 0) return null;
  const atual = recente.acumulado[ate - 1] ?? 0;
  const comparacoes = anos
    .slice(0, -1)
    .reverse()
    .map(({ ano, acumulado }) => {
      const anterior = acumulado[ate - 1] ?? 0;
      return { ano, razao: anterior > 0 ? atual / anterior - 1 : null };
    });
  return { ano: recente.ano, mes: ate, comparacoes };
}

/**
 * Os 4 anos com o faturado de cada mês e quantos meses tiveram compra, entre os que fecharam. O mês
 * que ainda não fechou, ou que a história não alcança, fica null.
 */
export function montarMapaDeCalor(mensal: readonly FaturamentoMensal[], mesAtual: string): AnoNoMapa[] {
  const historia = porMes(mensal);
  return anosDaTendencia(mesAtual).map(({ ano, ultimoMes }) => {
    const meses = mesesDe(`${ano}-01`, `${ano}-12`).map((mes) => (mes <= ultimoMes ? (historia.get(mes)?.valor ?? null) : null));
    const fechados = meses.filter((valor) => valor !== null);
    return { ano, meses, mesesComCompra: fechados.filter((valor) => valor > 0).length, mesesFechados: fechados.length };
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

/** Os 4 anos do calendário até o do mês passado: os anteriores inteiros e o último até o mês passado. */
function anosDaTendencia(mesAtual: string): { ano: number; ultimoMes: string }[] {
  const ultimoFechado = somarMeses(mesAtual, -1);
  const anoFinal = Number(ultimoFechado.slice(0, 4));
  return Array.from({ length: ANOS_DA_TENDENCIA }, (_, i) => {
    const ano = anoFinal - ANOS_DA_TENDENCIA + 1 + i;
    return { ano, ultimoMes: ano === anoFinal ? ultimoFechado : `${ano}-12` };
  });
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
function somarOsDozeMeses(historia: HistoriaPorMes, fim: string, medida: "valor" | "pecas"): number | null {
  let soma = 0;
  for (const mes of mesesDe(somarMeses(fim, 1 - MESES_DO_ANO), fim)) {
    const doMes = historia.get(mes);
    if (!doMes) return null;
    soma += doMes[medida];
  }
  return soma;
}
