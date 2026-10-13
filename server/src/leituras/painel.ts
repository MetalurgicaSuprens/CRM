import type { DatabaseSync } from "node:sqlite";
import type { PainelInicio } from "../../../web/src/dados/tipos.ts";
import type { Sessao } from "../sessao.ts";
import { destaquesDasAnalises, lerAnalises } from "./analises.ts";
import { escopo, lerDadosDaFoto, lerLinhas, numero, numeroOuNulo, texto } from "./linhas.ts";

/*
 * Início. Indicadores na visão do representante: somas dos códigos do login, mês a mês, do que o
 * extrator gravou por representante. Destaques na visão do cliente, das listas das análises.
 */

export function lerPainel(db: DatabaseSync, sessao: Sessao): PainelInicio {
  const foto = lerDadosDaFoto(db);
  const mesAtual = texto(foto, "mes_atual");
  const { marcas, codigos } = escopo(sessao);
  const meses = lerLinhas(
    db,
    `SELECT mes, SUM(faturado) AS faturado, SUM(ano_anterior) AS ano_anterior,
            SUM(ano_anterior_ate_dia_util) AS ate_dia_util
       FROM painel_mes WHERE representante IN (${marcas}) GROUP BY mes ORDER BY mes`,
    codigos,
  );
  const pedidos = lerLinhas(
    db,
    `SELECT COUNT(*) AS quantidade, COALESCE(SUM(valor), 0) AS valor, COALESCE(SUM(valor_entrega_no_mes), 0) AS no_mes
       FROM pedido_aberto WHERE representante IN (${marcas})`,
    codigos,
  )[0] ?? {};
  const aFaturarNoMes = numero(pedidos, "no_mes");
  const corrente = meses.find((mes) => texto(mes, "mes") === mesAtual) ?? {};
  const anteriores = meses.filter((mes) => texto(mes, "mes") < mesAtual);
  const somar = (linhas: typeof meses, coluna: string) => linhas.reduce((soma, linha) => soma + numero(linha, coluna), 0);
  return {
    mesAtual: {
      mes: mesAtual,
      faturado: numero(corrente, "faturado"),
      anoAnteriorMesmoDiaUtil: numero(corrente, "ate_dia_util"),
      aFaturarNoMes,
      diaUtil: numero(foto, "dia_util"),
      diasUteis: numero(foto, "dias_uteis"),
    },
    ano: {
      acumulado: somar(anteriores, "faturado") + numero(corrente, "faturado"),
      acumuladoAnoAnterior: somar(anteriores, "ano_anterior") + numero(corrente, "ate_dia_util"),
    },
    pedidosEmAberto: { quantidade: numero(pedidos, "quantidade"), valor: numero(pedidos, "valor") },
    mensal: meses.map((mes) => ({
      mes: texto(mes, "mes"),
      faturado: numeroOuNulo(mes, "faturado"),
      anoAnterior: numero(mes, "ano_anterior"),
      aFaturar: texto(mes, "mes") === mesAtual ? aFaturarNoMes : null,
    })),
    destaques: destaquesDasAnalises(lerAnalises(db, sessao)),
  };
}
