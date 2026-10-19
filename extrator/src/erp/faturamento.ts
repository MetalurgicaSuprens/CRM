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

/**
 * Faturado por representante e dia, desde o começo dos meses da ficha (60 fechados): os indicadores
 * do Início e a tendência dele, que soma 12 meses até cada um dos últimos 48.
 */
export async function lerVendasPorDia(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<VendaDoDia[]> {
  const lista = emLista("r", autorizados);
  const representante = representanteDaVenda("M.VENDEDOR");
  const linhas = await oracle.consultar(
    `SELECT ${representante}, ${textoDaData("M.DT_EMISSAO")}, SUM(${VALOR_DO_ITEM})
     ${ITENS_DAS_NOTAS}
     ${CLIENTE_DA_NOTA}
      WHERE ${NOTA_DE_VENDA} AND M.DT_EMISSAO >= ${data("inicio")} AND ${representante} IN ${lista.sql}
      GROUP BY ${representante}, ${textoDaData("M.DT_EMISSAO")}`,
    { ...lista.binds, inicio: referencia.inicioDaFicha },
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
 * Pedidos com nota de venda nos 12 meses fechados e no corrente, com as linhas dessas notas: o
 * histórico da ficha. O cliente, o representante e a emissão são os do pedido (VEPM, alias O, porque
 * P é o produto da família). Nota sem pedido no VEPM fica de fora (nenhuma da Star Vendas, em 2026-10-15).
 */
export async function lerPedidosFaturados(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<PedidoFaturadoNoErp[]> {
  const lista = emLista("r", autorizados);
  const representante = representanteDaVenda("O.VENDEDOR");
  const linhas = await oracle.consultar(
    `SELECT O.EMP_FIL, O.NUMERO, O.CLIENTE, ${representante}, ${textoDaData("O.DT_PED")}, ${textoDaData("M.DT_EMISSAO")},
            TRIM(D.C_PROD), TRIM(G.GRP_DES), ${PECAS_DO_ITEM}, ${VALOR_DO_ITEM}
     ${ITENS_DAS_NOTAS}
       JOIN ABC71.VEPM O ON O.EMP_FIL = M.EMP_FIL AND O.NUMERO = M.NRO_PEDIDO
       LEFT JOIN ABC71.CRCL C ON C.EMP_FIL = O.EMP_FIL AND C.CLIENTE = O.CLIENTE
     ${FAMILIA_DO_ITEM}
      WHERE ${NOTA_DE_VENDA} AND M.DT_EMISSAO >= ${data("inicio")} AND ${representante} IN ${lista.sql}
      ORDER BY O.EMP_FIL, O.NUMERO, M.DT_EMISSAO, M.N_FISCAL, D.LINHA`,
    { ...lista.binds, inicio: referencia.inicio12 },
  );
  return agruparPorPedidoFaturado(linhas);
}

/** Uma linha por item de nota; o cabeçalho do pedido se repete em cada uma, e a última nota fica. */
function agruparPorPedidoFaturado(linhas: Linha[]): PedidoFaturadoNoErp[] {
  const pedidos = new Map<string, PedidoFaturadoNoErp>();
  for (const linha of linhas) {
    const chaveDoPedido = `${numero(linha, 0)}/${numero(linha, 1)}`;
    const pedido = pedidos.get(chaveDoPedido) ?? {
      pedido: String(numero(linha, 1)),
      chave: chaveDoCliente(numero(linha, 0), numero(linha, 2)),
      representante: String(numero(linha, 3)),
      emissao: texto(linha, 4),
      faturadoEm: texto(linha, 5),
      itens: [],
    };
    pedido.faturadoEm = texto(linha, 5);
    pedido.itens.push({ produto: texto(linha, 6), familia: textoOuNulo(linha, 7), pecas: numero(linha, 8), valor: numero(linha, 9) });
    pedidos.set(chaveDoPedido, pedido);
  }
  return [...pedidos.values()];
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
