import type { VendaDoDia } from "../erp/tipos.ts";
import { corteDoMesmoDiaUtil, diaUtilDoMes, type Calendario } from "./calendario.ts";
import type { Referencia } from "./referencia.ts";

/*
 * Indicadores do Início na visão do representante: faturado de cada mês do ano corrente, o mesmo
 * mês do ano anterior e, no mês corrente, o ano anterior até o mesmo dia útil.
 */

export type MesDoPainel = {
  representante: string;
  mes: string;
  /** null nos meses que ainda não chegaram. */
  faturado: number | null;
  anoAnterior: number;
  /** Só no mês corrente. */
  anoAnteriorAteDiaUtil: number | null;
};

export function montarPainel(
  vendas: readonly VendaDoDia[],
  autorizados: readonly string[],
  referencia: Referencia,
  calendario: Calendario,
): MesDoPainel[] {
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
        anoAnteriorAteDiaUtil: mes === referencia.mesAtual ? ateOMesmoDiaUtil(doRepresentante, mesAnterior, referencia, calendario) : null,
      };
    });
  });
}

function ateOMesmoDiaUtil(vendas: readonly VendaDoDia[], mes: string, referencia: Referencia, calendario: Calendario): number {
  const corte = corteDoMesmoDiaUtil(mes, diaUtilDoMes(referencia.hoje, calendario), calendario);
  return somar(vendas.filter((venda) => venda.dia.startsWith(mes) && (corte === null || venda.dia < corte)));
}

function somarDoMes(vendas: readonly VendaDoDia[], mes: string): number {
  return somar(vendas.filter((venda) => venda.dia.startsWith(mes)));
}

function somar(vendas: readonly VendaDoDia[]): number {
  return vendas.reduce((soma, venda) => soma + venda.valor, 0);
}
