import { somarMeses } from "dominio/datas";
import { MESES_DO_RITMO } from "dominio/projecao";
import type { VendaDoDia } from "../erp/tipos.ts";
import { corteDoMesmoDiaUtil, diaUtilDoMes, diasUteisDoMes } from "dominio/calendario";
import type { Referencia } from "./referencia.ts";

/*
 * Indicadores do Início na visão do representante: faturado de cada mês do ano corrente, o mesmo
 * mês do ano anterior e, no mês corrente, o ano anterior até o mesmo dia útil e o ritmo dos
 * últimos 6 meses, base da projeção (dominio/projecao.ts). E a história de cada mês fechado, que a
 * tendência do Início soma de 12 em 12.
 */

export type MesDoPainel = {
  representante: string;
  mes: string;
  /** null nos meses que ainda não chegaram. */
  faturado: number | null;
  anoAnterior: number;
  /** Só no mês corrente. */
  anoAnteriorAteDiaUtil: number | null;
  /** Só no mês corrente: faturado por dia útil nos últimos 6 meses fechados. */
  ritmoPorDiaUtil: number | null;
};

export function montarPainel(vendas: readonly VendaDoDia[], autorizados: readonly string[], referencia: Referencia): MesDoPainel[] {
  const ano = Number(referencia.mesAtual.slice(0, 4));
  const meses = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  return autorizados.flatMap((representante) => {
    const doRepresentante = vendas.filter((venda) => venda.representante === representante);
    return meses.map((numero) => {
      const mes = `${ano}-${numero}`;
      const mesAnterior = `${ano - 1}-${numero}`;
      return {
        representante,
        mes,
        faturado: mes > referencia.mesAtual ? null : somarDoMes(doRepresentante, mes),
        anoAnterior: somarDoMes(doRepresentante, mesAnterior),
        anoAnteriorAteDiaUtil: mes === referencia.mesAtual ? ateOMesmoDiaUtil(doRepresentante, mesAnterior, referencia) : null,
        ritmoPorDiaUtil: mes === referencia.mesAtual ? ritmoDosUltimosMeses(doRepresentante, referencia.mesAtual) : null,
      };
    });
  });
}

/** O faturado de cada mês fechado dos meses da ficha, por representante; o mês sem venda vale 0. */
export function montarHistoricoDoPainel(
  vendas: readonly VendaDoDia[],
  autorizados: readonly string[],
  referencia: Referencia,
): { representante: string; mes: string; faturado: number }[] {
  const fechados = referencia.mesesDaFicha.filter((mes) => mes < referencia.mesAtual);
  return autorizados.flatMap((representante) => {
    const porMes = new Map<string, number>();
    for (const venda of vendas) {
      if (venda.representante !== representante) continue;
      const mes = venda.dia.slice(0, 7);
      porMes.set(mes, (porMes.get(mes) ?? 0) + venda.valor);
    }
    return fechados.map((mes) => ({ representante, mes, faturado: porMes.get(mes) ?? 0 }));
  });
}

function ateOMesmoDiaUtil(vendas: readonly VendaDoDia[], mes: string, referencia: Referencia): number {
  const corte = corteDoMesmoDiaUtil(mes, diaUtilDoMes(referencia.hoje));
  return somar(vendas.filter((venda) => venda.dia.startsWith(mes) && (corte === null || venda.dia < corte)));
}

/** Faturado por dia útil nos 6 meses fechados antes do corrente. */
function ritmoDosUltimosMeses(vendas: readonly VendaDoDia[], mesAtual: string): number {
  const meses = Array.from({ length: MESES_DO_RITMO }, (_, i) => somarMeses(mesAtual, -(i + 1)));
  const diasUteis = meses.reduce((soma, mes) => soma + diasUteisDoMes(mes), 0);
  const faturado = meses.reduce((soma, mes) => soma + somarDoMes(vendas, mes), 0);
  return diasUteis > 0 ? faturado / diasUteis : 0;
}

function somarDoMes(vendas: readonly VendaDoDia[], mes: string): number {
  return somar(vendas.filter((venda) => venda.dia.startsWith(mes)));
}

function somar(vendas: readonly VendaDoDia[]): number {
  return vendas.reduce((soma, venda) => soma + venda.valor, 0);
}
