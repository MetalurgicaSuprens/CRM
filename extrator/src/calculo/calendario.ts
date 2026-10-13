import { isFimDeSemana, ultimoDiaDoMes } from "dominio/datas";

/*
 * Dias úteis pelo calendário do SGI (SGI5_TAB_DP_CALEND). Dia sem linha no calendário cai para
 * segunda a sexta.
 */

export type Calendario = ReadonlyMap<string, boolean>;

export function isDiaUtil(dia: string, calendario: Calendario): boolean {
  return calendario.get(dia) ?? !isFimDeSemana(dia);
}

/** Dias úteis do mês até a data, inclusive: o "8º" de "8º de 22 dias úteis". */
export function diaUtilDoMes(data: string, calendario: Calendario): number {
  return diasDoMes(data.slice(0, 7)).filter((dia) => dia <= data && isDiaUtil(dia, calendario)).length;
}

export function diasUteisDoMes(mes: string, calendario: Calendario): number {
  return diasDoMes(mes).filter((dia) => isDiaUtil(dia, calendario)).length;
}

/**
 * Onde acaba o "mesmo dia útil" num mês: a venda entra até antes do (N+1)º dia útil, para contar
 * as notas de sábado e de feriado logo depois do Nº (docs/dados-por-tela.md, Início). null quando
 * o mês tem N dias úteis ou menos: entra o mês inteiro.
 */
export function corteDoMesmoDiaUtil(mes: string, diaUtil: number, calendario: Calendario): string | null {
  return diasDoMes(mes).filter((dia) => isDiaUtil(dia, calendario))[diaUtil] ?? null;
}

function diasDoMes(mes: string): string[] {
  return Array.from({ length: ultimoDiaDoMes(mes) }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`);
}
