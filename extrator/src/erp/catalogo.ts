import type { Referencia } from "../calculo/referencia.ts";
import type { Oracle } from "../oracle.ts";
import { condicaoDaCarteira } from "./carteira.ts";
import { chaveDoCliente, numero, texto, textoOuNulo } from "./linha.ts";
import { ITENS_DAS_NOTAS, NOTA_DE_VENDA, data, emLista, emListaDeTexto } from "./sql.ts";
import type { PartNumberDaBiblia, PrecoDoCliente, ProdutoDaTabela, ProdutoJaComprado, TabelaDoCliente } from "./tipos.ts";

/*
 * O catálogo dos clientes da carteira. O preço vem da view de preço líquido do SGI, a mesma da tela
 * de pedido: o preço da tabela do cliente com o desconto do modelo do produto (SGI5_TAB_VEN_CLI2,
 * pelo PAC_MOD) e, sem ele, com o desconto padrão do cliente (CLI_DES), como o Lucas definiu em
 * 2026-10-14. Conferido em 14/10: a conta refeita pelas tabelas dá o mesmo preço nos 122.142 pares
 * de cliente e produto da Star Vendas.
 */

/** Os clientes da carteira, para as leituras abaixo. Binds: os da lista e :inicio. */
function clientesDaCarteira(lista: string): string {
  return `SELECT C.CLIENTE FROM ABC71.CRCL C WHERE ${condicaoDaCarteira(lista)}`;
}

export async function lerTabelasDosClientes(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<TabelaDoCliente[]> {
  const lista = emLista("r", autorizados);
  const linhas = await oracle.consultar(
    `SELECT A.CLI_COD, TRIM(A.CLI_TAB), TRIM(A.CLI_STA), TRIM(P.TP1_NOM), TRIM(P.TP1_MOE), TRIM(P.TP1_STA)
       FROM ABC71.SGI5_TAB_VEN_CLI A
       LEFT JOIN ABC71.SGI5_TAB_VEN_TP1 P ON TRIM(P.TP1_COD) = TRIM(A.CLI_TAB)
      WHERE A.CLI_COD IN (${clientesDaCarteira(lista.sql)})`,
    { ...lista.binds, inicio: referencia.inicioDaJanela },
  );
  return linhas.map((linha) => ({
    cliente: numero(linha, 0),
    tabela: texto(linha, 1),
    papel: textoOuNulo(linha, 2),
    nome: textoOuNulo(linha, 3),
    moeda: textoOuNulo(linha, 4),
    situacao: textoOuNulo(linha, 5),
  }));
}

/**
 * Um preço por cliente, tabela e produto ativo. A view repete o produto por part number e por
 * depósito do ESTQ, sempre com o mesmo preço (conferido em 14/10): fica uma linha por produto.
 * Saem o produto inativo no Omega e o produto sem árvore, que o SGI não deixa vender.
 */
export async function lerPrecos(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<PrecoDoCliente[]> {
  const lista = emLista("r", autorizados);
  const linhas = await oracle.consultar(
    `SELECT V.VIEW_CLI, TRIM(V.VIEW_TAB), TRIM(V.VIEW_PAC), MAX(V.VIEW_VLR_LIQ)
       FROM ABC71.SGI5_VIEW_VEN_TP2_VLR_LIQ_CLI V
      WHERE V.VIEW_CLI IN (${clientesDaCarteira(lista.sql)}) AND V.VIEW_STA LIKE 'ATIVO%' AND V.VIEW_VLR_LIQ > 0
        AND NOT EXISTS (SELECT 1 FROM ABC71.ESTQ E WHERE TRIM(E.C_PROD) = TRIM(V.VIEW_PAC) AND NVL(TRIM(E.QT_ALT_OBR), 'A') = 'I')
        AND NOT EXISTS (SELECT 1 FROM ABC71.SGI5_VIEW_ENG_PAC_SEM_ARVORE S WHERE TRIM(S.VIEW_PAC) = TRIM(V.VIEW_PAC))
      GROUP BY V.VIEW_CLI, TRIM(V.VIEW_TAB), TRIM(V.VIEW_PAC)`,
    { ...lista.binds, inicio: referencia.inicioDaJanela },
  );
  return linhas.map((linha) => ({
    cliente: numero(linha, 0),
    tabela: texto(linha, 1),
    produto: texto(linha, 2),
    precoCento: numero(linha, 3),
  }));
}

/**
 * Os part numbers da Bíblia Montadora (SGI: Relatórios > Administrativo > Vendas): o "Código Cliente"
 * dos itens das tabelas de preço de montadora (TP1_TIP = 'M'), só dos ativos, como o Lucas pediu em
 * 2026-10-20. É a consulta do relatório (untVenTab_RelBibliaMont.dfm, qryRel) com o status ATIVO, que
 * o menu passa como 'ATIVO%' e por isso inclui o ATIVO-DB (Principal.pas, ImprimirRelVen001). O
 * part number '0' é vazio, como no relatório.
 */
export async function lerPartNumbersDaBiblia(oracle: Oracle): Promise<PartNumberDaBiblia[]> {
  const linhas = await oracle.consultar(
    `SELECT DISTINCT TRIM(A.TP2_PRO), TRIM(A.TP2_CMO)
       FROM ABC71.SGI5_TAB_VEN_TP2 A
       JOIN ABC71.SGI5_TAB_VEN_TP1 B ON TRIM(B.TP1_COD) = TRIM(A.TP2_COD)
      WHERE B.TP1_TIP = 'M' AND TRIM(A.TP2_STA) LIKE 'ATIVO%' AND NULLIF(TRIM(A.TP2_CMO), '0') IS NOT NULL`,
  );
  return linhas.map((linha) => ({ produto: texto(linha, 0), partNumber: texto(linha, 1) }));
}

/** A embalagem é a quantidade do EAN do produto: em 14/10, cada produto do catálogo tinha um só. */
export async function lerProdutosDasTabelas(oracle: Oracle, tabelas: string[]): Promise<ProdutoDaTabela[]> {
  if (tabelas.length === 0) return [];
  const lista = emListaDeTexto("t", tabelas);
  const linhas = await oracle.consultar(
    `SELECT TRIM(P.PAC_COD), TRIM(G.GRP_DES), P.PAC_DMI_MM, P.PAC_DMA_MM,
            (SELECT MAX(E.EAN_QTD) FROM ABC71.SGI5_TAB_ENG_EAN E WHERE TRIM(E.EAN_COD) = TRIM(P.PAC_COD))
       FROM ABC71.SGI5_TAB_ENG_PAC P
       LEFT JOIN ABC71.SGI5_TAB_CUS_V3_GRP G ON G.GRP_GRP = P.PAC_GRC
      WHERE TRIM(P.PAC_COD) IN (SELECT TRIM(B.TP2_PRO) FROM ABC71.SGI5_TAB_VEN_TP2 B WHERE TRIM(B.TP2_COD) IN ${lista.sql})`,
    lista.binds,
  );
  return linhas.map((linha) => ({
    produto: texto(linha, 0),
    familia: textoOuNulo(linha, 1),
    medidaMinimaMm: numeroPositivoOuNulo(numero(linha, 2)),
    medidaMaximaMm: numeroPositivoOuNulo(numero(linha, 3)),
    embalagem: numeroPositivoOuNulo(numero(linha, 4)),
  }));
}

/** Os produtos que cada cliente da carteira comprou nos últimos 24 meses, com o mês corrente. */
export async function lerProdutosJaComprados(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<ProdutoJaComprado[]> {
  const lista = emLista("r", autorizados);
  const linhas = await oracle.consultar(
    `SELECT DISTINCT M.EMP_FIL, M.FORNEC, TRIM(D.C_PROD)
     ${ITENS_DAS_NOTAS}
       JOIN ABC71.CRCL C ON C.EMP_FIL = M.EMP_FIL AND C.CLIENTE = M.FORNEC
      WHERE ${NOTA_DE_VENDA} AND C.VEND_1 IN ${lista.sql} AND M.DT_EMISSAO >= ${data("inicio24")}`,
    { ...lista.binds, inicio24: referencia.inicio24 },
  );
  return linhas.map((linha) => ({ chave: chaveDoCliente(numero(linha, 0), numero(linha, 1)), produto: texto(linha, 2) }));
}

function numeroPositivoOuNulo(valor: number): number | null {
  return valor > 0 ? valor : null;
}
