import type { Oracle } from "../oracle.ts";
import { numero, texto, textoOuNulo } from "./linha.ts";
import { emListaDeTexto } from "./sql.ts";

/*
 * O que a gravação do pedido no SGI lê no Oracle, na hora, como o app antigo dos representantes lê
 * (SGI6R: qryPosCliTab, qryPosPac, qryPosTransp, qryPosVlrMinVen e qryNumPed; docs/pedido-no-sgi.md).
 */

/** O cadastro do cliente que vai no cabeçalho do pedido, com a tabela PRINCIPAL. */
export type CadastroDoPedido = {
  cfop: number;
  tributacao: number;
  tipoDeMovimento: number;
  tabela: string;
  moeda: string | null;
  /** "SIM" ou "NAO", da NFTF; null quando o CFOP e a tributação não têm linha lá. */
  baseDoIpi: string | null;
  baseDoIcms: string | null;
  aliquotaDoIcms: number;
  vendedor: number;
  comissao: number;
  territorio: number;
  banco: number;
  carteira: number;
  textoGenerico: number;
  formaDePagamento: number | null;
};

/** O produto na view de preço do cliente, como o SGI6R o põe no item. */
export type ProdutoDoPedido = {
  produto: string;
  /** Os part numbers da tabela para o produto (VIEW_PNU, sem o '0'), cada um com o do fornecedor (VIEW_PNU_FOR). */
  partNumbersDaTabela: ReadonlyMap<string, string>;
  procedencia: number;
  aliquotaDoIpi: number;
  desconto: string;
  indiceDoDesconto: number;
  valorDeTabela: number;
  valorLiquido: number;
  mercado: string;
};

/** O endereço de entrega da transportadora (SGI5_TAB_LOG_TRA); null quando ela não tem. */
export type EnderecoDaTransportadora = { endereco: string; numero: number | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: number | null };

/** As colunas do preço mínimo por margem, sem o "CUS_VLM_" do começo: PRAIS_MGB, PRA4_MGL_COM… */
export type PrecosMinimos = Readonly<Record<string, number>>;

const FAIXAS_DO_PRECO_MINIMO = ["PRAIS", "PRA4", "PRA7", "PRA12", "PRA18", "EXP"] as const;
const COLUNAS_DO_PRECO_MINIMO = FAIXAS_DO_PRECO_MINIMO.flatMap((faixa) => ["MGB", "MGB_COM", "MGL", "MGL_COM"].map((margem) => `${faixa}_${margem}`));
/** Depois de 2.999.999, o SGI volta ao 1 (SGI6R, qryNumPed). */
const MAIOR_NUMERO_DE_PEDIDO = 2_999_999;

/** O cadastro do cliente para o pedido; null sem a tabela PRINCIPAL, que o SGI6R exige. */
export async function lerCadastroDoPedido(oracle: Oracle, empresa: number, cliente: number): Promise<CadastroDoPedido | null> {
  const linhas = await oracle.consultar(
    `SELECT A.CFO, B.CLI_CTR, B.CLI_TMO, TRIM(B.CLI_TAB), TRIM(M.TP1_MOE),
            CASE WHEN TRIM(I.BASE_IPI) = 'S' THEN 'SIM' WHEN TRIM(I.BASE_IPI) = 'N' THEN 'NAO' END,
            CASE WHEN TRIM(I.BASE_ICM) = 'S' THEN 'SIM' WHEN TRIM(I.BASE_ICM) = 'N' THEN 'NAO' END,
            D.ICM_PORC, A.VEND_1, G.PORC_COMISSAO, A.TERR_1,
            TO_NUMBER(SUBSTR(TRIM(TO_CHAR(A.BANCO_CART_PORT, '0000')), 1, 3)),
            TO_NUMBER(SUBSTR(TRIM(TO_CHAR(A.BANCO_CART_PORT, '0000')), 4, 1)),
            A.CENTRAL_PGTO, O.RESERVADO_10
       FROM ABC71.CRCL A
       LEFT JOIN ABC71.SGI5_TAB_VEN_CLI B ON A.CLIENTE = B.CLI_COD
       LEFT JOIN ABC71.TPUF D ON A.ESTADO = D.SIGLA_EST AND D.EMPRESA = 2021
       LEFT JOIN ABC71.CRVN G ON A.VEND_1 = G.VENDEDOR
       LEFT JOIN ABC71.NFTF I ON A.CFO = I.COD_CFO AND B.CLI_CTR = I.COD_TRIB
       LEFT JOIN ABC71.SGI5_TAB_VEN_TP1 M ON TRIM(B.CLI_TAB) = TRIM(M.TP1_COD)
       LEFT JOIN ABC71.CRCLX O ON A.CLIENTE = O.CLIENTE
      WHERE A.EMP_FIL = :empresa AND A.CLIENTE = :cliente AND TRIM(NVL(B.CLI_STA, 'PRINCIPAL')) = 'PRINCIPAL'`,
    { empresa, cliente },
  );
  // A CRVN tem uma linha por gerente e supervisor: as do mesmo cliente repetem o cadastro.
  const [linha] = linhas;
  if (!linha) return null;
  return {
    cfop: numero(linha, 0),
    tributacao: numero(linha, 1),
    tipoDeMovimento: numero(linha, 2),
    tabela: texto(linha, 3),
    moeda: textoOuNulo(linha, 4),
    baseDoIpi: textoOuNulo(linha, 5),
    baseDoIcms: textoOuNulo(linha, 6),
    aliquotaDoIcms: numero(linha, 7),
    vendedor: numero(linha, 8),
    comissao: numero(linha, 9),
    territorio: numero(linha, 10),
    banco: numero(linha, 11),
    carteira: numero(linha, 12),
    textoGenerico: numero(linha, 13),
    formaDePagamento: linha[14] === null || linha[14] === undefined ? null : numero(linha, 14),
  };
}

/**
 * Os produtos do pedido na view de preço do cliente, só os ativos e liberados para representante. A
 * view repete o produto por part number, com o mesmo preço: os valores vêm da primeira linha, e os part
 * numbers de todas, para o item achar o do fornecedor do número que o representante escolheu.
 */
export async function lerProdutosDoPedido(oracle: Oracle, cliente: number, tabela: string, produtos: readonly string[]): Promise<Map<string, ProdutoDoPedido>> {
  const lista = emListaDeTexto("p", produtos);
  const linhas = await oracle.consultar(
    `SELECT TRIM(A.VIEW_PAC), TRIM(A.VIEW_PNU), TRIM(A.VIEW_PNU_FOR), A.VIEW_PCD, A.VIEW_ALI_IPI, TRIM(A.VIEW_DSC), A.VIEW_DSC_IND,
            A.VIEW_VLR_TAB, A.VIEW_VLR_LIQ, TRIM(A.VIEW_MER)
       FROM ABC71.SGI5_VIEW_VEN_TP2_VLR_LIQ_CLI A
      WHERE TRIM(A.VIEW_STA) LIKE 'ATIVO%' AND TRIM(A.VIEW_IPR) = 'SIM'
        AND A.VIEW_CLI = :cliente AND TRIM(A.VIEW_TAB) = :tabela AND TRIM(A.VIEW_PAC) IN ${lista.sql}
      ORDER BY TRIM(A.VIEW_PAC), TRIM(A.VIEW_PNU)`,
    { ...lista.binds, cliente, tabela },
  );
  const porProduto = new Map<string, ProdutoDoPedido>();
  for (const linha of linhas) {
    const produto = texto(linha, 0);
    const partNumber = texto(linha, 1);
    const jaLido = porProduto.get(produto);
    const partNumbers = new Map(jaLido?.partNumbersDaTabela ?? []);
    if (partNumber !== "" && partNumber !== "0") partNumbers.set(partNumber, texto(linha, 2));
    if (jaLido) {
      porProduto.set(produto, { ...jaLido, partNumbersDaTabela: partNumbers });
      continue;
    }
    porProduto.set(produto, {
      produto,
      partNumbersDaTabela: partNumbers,
      procedencia: numero(linha, 3),
      aliquotaDoIpi: numero(linha, 4),
      desconto: texto(linha, 5),
      indiceDoDesconto: numero(linha, 6),
      valorDeTabela: numero(linha, 7),
      valorLiquido: numero(linha, 8),
      mercado: texto(linha, 9),
    });
  }
  return porProduto;
}

/** O preço mínimo por margem de cada produto, o do dia, como o SGI6R; o produto sem linha fica sem. */
export async function lerPrecosMinimos(oracle: Oracle, produtos: readonly string[]): Promise<Map<string, PrecosMinimos>> {
  const lista = emListaDeTexto("p", produtos);
  const linhas = await oracle.consultar(
    `SELECT TRIM(A.CUS_PAC), ${COLUNAS_DO_PRECO_MINIMO.map((coluna) => `A.CUS_VLM_${coluna}`).join(", ")}
       FROM ABC71.SGI5_TAB_CUS_REP_VLR_MIN_VEN A
      WHERE A.CUS_DMO = TRUNC(SYSDATE) AND TRIM(A.CUS_PAC) IN ${lista.sql}`,
    lista.binds,
  );
  return new Map(linhas.map((linha) => [texto(linha, 0), Object.fromEntries(COLUNAS_DO_PRECO_MINIMO.map((coluna, i) => [coluna, numero(linha, i + 1)]))]));
}

export async function lerEnderecoDaTransportadora(oracle: Oracle, transportadora: string): Promise<EnderecoDaTransportadora | null> {
  const [linha] = await oracle.consultar(
    `SELECT TRIM(B.TRA_END), B.TRA_NUM, TRIM(B.TRA_COM), TRIM(B.TRA_BAI), TRIM(B.TRA_CID), TRIM(B.TRA_UFE), B.TRA_CEP
       FROM ABC71.SGI5_TAB_LOG_TRA B WHERE B.TRA_TRA = :transportadora`,
    { transportadora: Number(transportadora) },
  );
  const endereco = linha ? textoOuNulo(linha, 0) : null;
  if (!linha || !endereco) return null;
  const numeroOuNulo = (coluna: number) => (linha[coluna] === null || linha[coluna] === undefined ? null : numero(linha, coluna));
  return {
    endereco,
    numero: numeroOuNulo(1),
    complemento: textoOuNulo(linha, 2),
    bairro: textoOuNulo(linha, 3),
    cidade: textoOuNulo(linha, 4),
    uf: textoOuNulo(linha, 5),
    cep: numeroOuNulo(6),
  };
}

/** O próximo número de pedido do SGI, como o SGI6R: o maior + 1, e 1 depois de 2.999.999. */
export async function lerProximoNumeroDePedido(oracle: Oracle): Promise<number> {
  const [linha] = await oracle.consultar(`SELECT MAX(NVL(A.PV1_NPE, 0)) FROM ABC71.SGI5_TAB_VEN_PV1_V2 A`);
  const maior = linha ? numero(linha, 0) : 0;
  return maior > MAIOR_NUMERO_DE_PEDIDO ? 1 : maior + 1;
}

/** O pedido de número `npe` deste cliente já está no SGI: a gravação interrompida depois de confirmar. */
export async function isPedidoNoSgi(oracle: Oracle, npe: number, cliente: number): Promise<boolean> {
  const [linha] = await oracle.consultar(`SELECT COUNT(*) FROM ABC71.SGI5_TAB_VEN_PV1_V2 A WHERE A.PV1_NPE = :npe AND A.PV1_CLI = :cliente`, { npe, cliente });
  return linha !== undefined && numero(linha, 0) > 0;
}

/** Quantos pedidos por consulta: o Oracle não aceita mais de 1.000 itens numa lista, e aqui são dois binds por pedido. */
const PEDIDOS_POR_CONSULTA = 400;

/**
 * O status e o total (sem IPI) de cada pedido do CRM no SGI, pelo número e pelo cliente: o número do SGI
 * volta a 1 depois de 2.999.999, e só o cliente distingue o pedido de hoje do antigo de mesmo número.
 */
export async function lerSituacaoNoSgi(oracle: Oracle, pedidos: readonly { numeroSgi: number; cliente: number }[]): Promise<Map<number, { status: string; total: number }>> {
  const situacoes = new Map<number, { status: string; total: number }>();
  for (let inicio = 0; inicio < pedidos.length; inicio += PEDIDOS_POR_CONSULTA) {
    const lote = pedidos.slice(inicio, inicio + PEDIDOS_POR_CONSULTA);
    const condicao = lote.map((_, i) => `(A.PV1_NPE = :n${i} AND A.PV1_CLI = :c${i})`).join(" OR ");
    const binds = Object.fromEntries(lote.flatMap(({ numeroSgi, cliente }, i) => [[`n${i}`, numeroSgi], [`c${i}`, cliente]]));
    const linhas = await oracle.consultar(
      `SELECT A.PV1_NPE, TRIM(A.PV1_STA), NVL(SUM(B.PV2_QTD * B.PV2_VLR_VEN), 0)
         FROM ABC71.SGI5_TAB_VEN_PV1_V2 A
         LEFT JOIN ABC71.SGI5_TAB_VEN_PV2_V2 B ON B.PV2_NPE = A.PV1_NPE
        WHERE ${condicao}
        GROUP BY A.PV1_NPE, TRIM(A.PV1_STA)`,
      binds,
    );
    for (const linha of linhas) situacoes.set(numero(linha, 0), { status: texto(linha, 1), total: numero(linha, 2) });
  }
  return situacoes;
}

/** A data de hoje no relógio do Oracle, "2026-11-23": é ela que o SGI6R grava (o Date do Delphi, no servidor do SGI). */
export async function lerHojeNoOracle(oracle: Oracle): Promise<string> {
  const [linha] = await oracle.consultar(`SELECT TO_CHAR(SYSDATE, 'YYYY-MM-DD') FROM DUAL`);
  if (!linha) throw new Error("O Oracle não devolveu a data.");
  return texto(linha, 0);
}
