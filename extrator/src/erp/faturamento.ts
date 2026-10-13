import type { Referencia } from "../calculo/referencia.ts";
import type { Oracle } from "../oracle.ts";
import { chaveDoCliente, numero, texto } from "./linha.ts";
import { ITENS_DAS_NOTAS, NOTA_DE_VENDA, VALOR_DO_ITEM, data, emLista, representanteDaVenda, textoDaData } from "./sql.ts";
import type { NotaRecente, VendaDoDia } from "./tipos.ts";

/*
 * A visão do representante: o que foi faturado em nome de cada autorizado, seja o cliente da
 * carteira dele hoje ou não (docs/plano.md, "Atribuição").
 */

const CLIENTE_DA_NOTA = "LEFT JOIN ABC71.CRCL C ON C.EMP_FIL = M.EMP_FIL AND C.CLIENTE = M.FORNEC";

/** Faturado por representante e dia, desde 1º de janeiro do ano anterior: indicadores do Início. */
export async function lerVendasPorDia(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<VendaDoDia[]> {
  const lista = emLista("r", autorizados);
  const representante = representanteDaVenda("M.VENDEDOR");
  const linhas = await oracle.consultar(
    `SELECT ${representante}, ${textoDaData("M.DT_EMISSAO")}, SUM(${VALOR_DO_ITEM})
     ${ITENS_DAS_NOTAS}
     ${CLIENTE_DA_NOTA}
      WHERE ${NOTA_DE_VENDA} AND M.DT_EMISSAO >= ${data("inicio")} AND ${representante} IN ${lista.sql}
      GROUP BY ${representante}, ${textoDaData("M.DT_EMISSAO")}`,
    { ...lista.binds, inicio: referencia.inicioDoAnoAnterior },
  );
  return linhas.map((linha) => ({ representante: String(numero(linha, 0)), dia: texto(linha, 1), valor: numero(linha, 2) }));
}

/** Notas dos últimos 45 dias, uma linha por nota: aba Faturados. */
export async function lerNotasRecentes(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<NotaRecente[]> {
  const lista = emLista("r", autorizados);
  const representante = representanteDaVenda("M.VENDEDOR");
  const linhas = await oracle.consultar(
    `SELECT M.N_FISCAL, TRIM(M.SERIE), M.EMP_FIL, M.FORNEC, ${representante}, ${textoDaData("MIN(M.DT_EMISSAO)")}, SUM(${VALOR_DO_ITEM})
     ${ITENS_DAS_NOTAS}
     ${CLIENTE_DA_NOTA}
      WHERE ${NOTA_DE_VENDA} AND M.DT_EMISSAO >= ${data("inicio")} AND ${representante} IN ${lista.sql}
      GROUP BY M.N_FISCAL, TRIM(M.SERIE), M.EMP_FIL, M.FORNEC, ${representante}`,
    { ...lista.binds, inicio: referencia.inicioDosFaturados },
  );
  return linhas.map((linha) => ({
    nota: String(numero(linha, 0)),
    serie: texto(linha, 1),
    chave: chaveDoCliente(numero(linha, 2), numero(linha, 3)),
    representante: String(numero(linha, 4)),
    emissao: texto(linha, 5),
    valor: numero(linha, 6),
  }));
}
