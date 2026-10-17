import { somarDias, somarMeses, ultimoDiaDoMes } from "dominio/datas";

/*
 * As datas que a foto usa, todas a partir do relógio do Oracle no início da leitura.
 */

/** Meses fechados de história: as análises olham até 12 meses antes de uma compra de 24 meses atrás. */
export const MESES_FECHADOS = 36;
/**
 * Meses fechados do gráfico da ficha: ele mostra até 48, e a média móvel de 12 meses do primeiro
 * usa os 11 anteriores. No trimestre e no ano, o primeiro período começa no início dele.
 */
const MESES_FECHADOS_DA_FICHA = 60;
const DIAS_DOS_FATURADOS = 45;

export type Referencia = {
  /** "2026-10-13T09:50", hora de Brasília no Oracle. */
  geradaEm: string;
  hoje: string;
  mesAtual: string;
  /** Os meses fechados e o corrente, do mais antigo ao mais recente. */
  meses: string[];
  inicioDaJanela: string;
  /** Os meses do gráfico da ficha, fechados e o corrente, do mais antigo ao mais recente. */
  mesesDaFicha: string[];
  /** Primeiro dia dos meses da ficha: as vendas por mês vêm desde ele. */
  inicioDaFicha: string;
  /** Primeiro dia dos 12 (ou 24) meses fechados. */
  inicio12: string;
  inicio24: string;
  inicioDoMesAtual: string;
  fimDoMesAtual: string;
  inicioDoAnoAnterior: string;
  /** Primeiro dia das notas da aba Faturados. */
  inicioDosFaturados: string;
};

export function montarReferencia(geradaEm: string): Referencia {
  const hoje = geradaEm.slice(0, 10);
  const mesAtual = hoje.slice(0, 7);
  const meses = Array.from({ length: MESES_FECHADOS + 1 }, (_, i) => somarMeses(mesAtual, i - MESES_FECHADOS));
  const mesesDaFicha = Array.from({ length: MESES_FECHADOS_DA_FICHA + 1 }, (_, i) => somarMeses(mesAtual, i - MESES_FECHADOS_DA_FICHA));
  return {
    geradaEm,
    hoje,
    mesAtual,
    meses,
    inicioDaJanela: `${meses[0]}-01`,
    mesesDaFicha,
    inicioDaFicha: `${mesesDaFicha[0]}-01`,
    inicio12: `${somarMeses(mesAtual, -12)}-01`,
    inicio24: `${somarMeses(mesAtual, -24)}-01`,
    inicioDoMesAtual: `${mesAtual}-01`,
    fimDoMesAtual: `${mesAtual}-${String(ultimoDiaDoMes(mesAtual)).padStart(2, "0")}`,
    inicioDoAnoAnterior: `${Number(hoje.slice(0, 4)) - 1}-01-01`,
    inicioDosFaturados: somarDias(hoje, -DIAS_DOS_FATURADOS),
  };
}
