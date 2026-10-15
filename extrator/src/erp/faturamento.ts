import type { Referencia } from "../calculo/referencia.ts";
import type { Linha, Oracle } from "../oracle.ts";
import { chaveDoCliente, numero, texto, textoOuNulo } from "./linha.ts";
import {
  FAMILIA_DO_ITEM,
  ITENS_DAS_NOTAS,
  NOTA_DE_VENDA,
  PECAS_DO_ITEM,
  VALOR_DO_ITEM,
  data,
  emLista,
  representanteDaVenda,
  textoDaData,
} from "./sql.ts";
import type { NotaRecente, PedidoFaturadoNoErp, VendaDoDia } from "./tipos.ts";

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

/**
 * Notas dos últimos 45 dias, item a item: aba Faturados. Uma nota pode ter linhas de mais de um tipo
 * de movimento no Oracle; para o CRM ela é uma só, pelo número e pela série.
 */
export async function lerNotasRecentes(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<NotaRecente[]> {
  const lista = emLista("r", autorizados);
  const representante = representanteDaVenda("M.VENDEDOR");
  const linhas = await oracle.consultar(
    `SELECT M.N_FISCAL, TRIM(M.SERIE), M.EMP_FIL, M.FORNEC, ${representante}, ${textoDaData("M.DT_EMISSAO")}, M.NRO_PEDIDO,
            TRIM(D.C_PROD), TRIM(G.GRP_DES), ${PECAS_DO_ITEM}, ${VALOR_DO_ITEM}
     ${ITENS_DAS_NOTAS}
     ${CLIENTE_DA_NOTA}
     ${FAMILIA_DO_ITEM}
      WHERE ${NOTA_DE_VENDA} AND M.DT_EMISSAO >= ${data("inicio")} AND ${representante} IN ${lista.sql}
      ORDER BY M.N_FISCAL, M.SERIE, M.TIPO_MOVTO, D.LINHA`,
    { ...lista.binds, inicio: referencia.inicioDosFaturados },
  );
  return agruparPorNota(linhas);
}

/**
 * Pedidos com nota de venda nos 12 meses fechados e no corrente, um por linha: o histórico da ficha.
 * O cliente e o representante são os do pedido (VEPM), e o valor e os produtos, os das notas do
 * período. Nota sem pedido no VEPM fica de fora (nenhuma da Star Vendas, em 2026-10-15).
 */
export async function lerPedidosFaturados(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<PedidoFaturadoNoErp[]> {
  const lista = emLista("r", autorizados);
  const representante = representanteDaVenda("P.VENDEDOR");
  const linhas = await oracle.consultar(
    `SELECT P.EMP_FIL, P.NUMERO, P.CLIENTE, ${representante}, ${textoDaData("P.DT_PED")}, ${textoDaData("MAX(M.DT_EMISSAO)")},
            COUNT(DISTINCT TRIM(D.C_PROD)), SUM(${VALOR_DO_ITEM})
     ${ITENS_DAS_NOTAS}
       JOIN ABC71.VEPM P ON P.EMP_FIL = M.EMP_FIL AND P.NUMERO = M.NRO_PEDIDO
       LEFT JOIN ABC71.CRCL C ON C.EMP_FIL = P.EMP_FIL AND C.CLIENTE = P.CLIENTE
      WHERE ${NOTA_DE_VENDA} AND M.DT_EMISSAO >= ${data("inicio")} AND ${representante} IN ${lista.sql}
      GROUP BY P.EMP_FIL, P.NUMERO, P.CLIENTE, ${representante}, P.DT_PED`,
    { ...lista.binds, inicio: referencia.inicio12 },
  );
  return linhas.map((linha) => ({
    pedido: String(numero(linha, 1)),
    chave: chaveDoCliente(numero(linha, 0), numero(linha, 2)),
    representante: String(numero(linha, 3)),
    emissao: texto(linha, 4),
    faturadoEm: texto(linha, 5),
    itens: numero(linha, 6),
    valor: numero(linha, 7),
  }));
}

/** Uma linha por item; o cabeçalho se repete em cada uma. */
function agruparPorNota(linhas: Linha[]): NotaRecente[] {
  const notas = new Map<string, NotaRecente>();
  for (const linha of linhas) {
    const id = idDaNota(linha);
    const nota = notas.get(id) ?? notaSemItens(linha);
    acrescentarLinha(nota, linha);
    notas.set(id, nota);
  }
  return [...notas.values()];
}

/** Número, série, empresa, cliente e representante: as cinco primeiras colunas identificam a nota. */
function idDaNota(linha: Linha): string {
  return [0, 1, 2, 3, 4].map((coluna) => texto(linha, coluna)).join("/");
}

function notaSemItens(linha: Linha): NotaRecente {
  return {
    nota: String(numero(linha, 0)),
    serie: texto(linha, 1),
    chave: chaveDoCliente(numero(linha, 2), numero(linha, 3)),
    representante: String(numero(linha, 4)),
    emissao: texto(linha, 5),
    pedidos: [],
    itens: [],
  };
}

/** A emissão da nota é a mais antiga das linhas dela; o pedido 0 é a nota sem pedido. */
function acrescentarLinha(nota: NotaRecente, linha: Linha): void {
  const emissao = texto(linha, 5);
  if (emissao < nota.emissao) nota.emissao = emissao;
  const pedido = String(numero(linha, 6));
  if (pedido !== "0" && !nota.pedidos.includes(pedido)) nota.pedidos.push(pedido);
  nota.itens.push({ produto: texto(linha, 7), familia: textoOuNulo(linha, 8), pecas: numero(linha, 9), valor: numero(linha, 10) });
}
