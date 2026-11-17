import type { Referencia } from "../calculo/referencia.ts";
import type { Oracle } from "../oracle.ts";
import { condicaoDaCarteira } from "./carteira.ts";
import { chaveDoCliente, numero, texto, textoOuNulo } from "./linha.ts";
import { data, emLista } from "./sql.ts";
import type { CadastroDoErp, CondicaoDoErp, EscolhasDoErp, LocalDoErp, TransportadoraDoErp, UltimoPedidoDoErp, UsoDaTransportadora } from "./tipos.ts";

/*
 * O que a tela de pedido precisa, lido como o app antigo dos representantes (SGI6R) lê: o cadastro do
 * cliente (qryPosCliTab), as transportadoras (qryPosTransp) e as condições de pagamento (qryPosCpg).
 * O histórico das escolhas vem dos pedidos do SGI (SGI5_TAB_VEN_PV1_V2 e PV2_V2) dos últimos 24 meses
 * que viraram pedido: a cotação e o cancelado não contam. Código lido em 2026-11-17
 * (C:\ProjetosCursor\SGIRepresentantesCodigoFonte\Server\ServerMethodsUnit1.dfm).
 */

/** O pedido que valeu: o que está esperando aprovação, aprovado ou já no Omega. */
const PEDIDO_QUE_VALEU = "TRIM(A.PV1_STA) IN ('PEDIDO', 'PEDIDO BLOQUEADO', 'PEDIDO OMEGA')";

/**
 * O documento como o SGI6R monta: no CNPJ, a raiz e a filial (CGC_CPF) com os dois dígitos; no CPF, o
 * CGC_CPF guarda quatro caracteres a mais no fim, que o SGI6R corta. Alias C = CRCL ou CRCA.
 */
export function documento(alias: string, fisicaOuJuridica: string): string {
  return `CASE WHEN ${fisicaOuJuridica} = 'F'
            THEN TRIM(REVERSE(SUBSTR(REVERSE(TRIM(${alias}.CGC_CPF)), 5, 15))) || TRIM(TO_CHAR(${alias}.DIG_CGC_CPF, '00'))
            ELSE TRIM(${alias}.CGC_CPF) || TRIM(TO_CHAR(${alias}.DIG_CGC_CPF, '00')) END`;
}

/** Binds de toda leitura da carteira: os códigos dos autorizados e o começo da janela. */
function bindsDaCarteira(referencia: Referencia, autorizados: string[]) {
  const lista = emLista("r", autorizados);
  return { lista, binds: { ...lista.binds, inicio: referencia.inicioDaJanela } };
}

export async function lerCadastros(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<CadastroDoErp[]> {
  const { lista, binds } = bindsDaCarteira(referencia, autorizados);
  const linhas = await oracle.consultar(
    `SELECT C.EMP_FIL, C.CLIENTE, TRIM(C.FIS_JURID), ${documento("C", "TRIM(C.FIS_JURID)")},
            TRIM(C.INSCR_ESTAD), TRIM(C.SUFRAMA), C.DDD, C.TELEFONE_1,
            (SELECT MAX(TRIM(X.E_MAIL)) FROM ABC71.CRCX X WHERE X.CLIENTE = C.CLIENTE),
            TRIM(C.ENDERECO), TRIM(C.BAIRRO), C.CEP, C.COND_PGTO,
            (SELECT MAX(TRIM(I.BASE_IPI))
               FROM ABC71.SGI5_TAB_VEN_CLI B
               JOIN ABC71.NFTF I ON I.COD_CFO = C.CFO AND I.COD_TRIB = B.CLI_CTR
              WHERE B.CLI_COD = C.CLIENTE AND TRIM(NVL(B.CLI_STA, 'PRINCIPAL')) = 'PRINCIPAL')
       FROM ABC71.CRCL C
      WHERE ${condicaoDaCarteira(lista.sql)}`,
    binds,
  );
  return linhas.map((linha) => ({
    chave: chaveDoCliente(numero(linha, 0), numero(linha, 1)),
    isPessoaFisica: texto(linha, 2) !== "J",
    documento: texto(linha, 3),
    inscricaoEstadual: textoOuNulo(linha, 4),
    suframa: textoOuNulo(linha, 5),
    ddd: numero(linha, 6),
    telefone: numero(linha, 7),
    emailDoXml: textoOuNulo(linha, 8),
    endereco: textoOuNulo(linha, 9),
    bairro: textoOuNulo(linha, 10),
    cep: numero(linha, 11),
    condicaoDePagamento: numero(linha, 12) > 0 ? String(numero(linha, 12)) : null,
    isBaseDoIpi: texto(linha, 13) === "S",
  }));
}

/** A cobrança (C) e a entrega (E) do cadastro (CRCA), como o SGI6R as mostra. */
export async function lerLocais(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<LocalDoErp[]> {
  const { lista, binds } = bindsDaCarteira(referencia, autorizados);
  const linhas = await oracle.consultar(
    `SELECT C.EMP_FIL, C.CLIENTE, TRIM(K.TIPO_REG), TRIM(K.RAZ_SOCIAL), ${documento("K", "TRIM(C.FIS_JURID)")},
            TRIM(K.ENDERECO), TRIM(K.BAIRRO), TRIM(K.CIDADE), TRIM(K.ESTADO), K.CEP
       FROM ABC71.CRCA K
       JOIN ABC71.CRCL C ON C.CLIENTE = K.CLIENTE
      WHERE TRIM(K.TIPO_REG) IN ('C', 'E') AND TRIM(K.ENDERECO) IS NOT NULL AND ${condicaoDaCarteira(lista.sql)}`,
    binds,
  );
  return linhas.map((linha) => ({
    chave: chaveDoCliente(numero(linha, 0), numero(linha, 1)),
    tipo: texto(linha, 2) === "C" ? "cobranca" : "entrega",
    razaoSocial: texto(linha, 3),
    documento: texto(linha, 4),
    endereco: texto(linha, 5),
    bairro: textoOuNulo(linha, 6),
    cidade: texto(linha, 7),
    uf: texto(linha, 8),
    cep: numero(linha, 9),
  }));
}

/** As transportadoras ativas do ERP: as do qryPosTransp do SGI6R, que tira as de nome fantasia INATIVO. */
export async function lerTransportadoras(oracle: Oracle): Promise<TransportadoraDoErp[]> {
  const linhas = await oracle.consultar(
    `SELECT A.FORNEC, TRIM(A.NOME_FANTAS), TRIM(A.RAZ_SOCIAL), ${documento("A", "TRIM(A.FIS_JURID)")}, TRIM(A.CIDADE), TRIM(A.ESTADO)
       FROM ABC71.CFOR A
      WHERE TRIM(A.TIPO_FORN) = 'T' AND NVL(TRIM(A.NOME_FANTAS), ' ') NOT LIKE '%INATIVO%'`,
  );
  return linhas.map((linha) => ({
    codigo: String(numero(linha, 0)),
    fantasia: textoOuNulo(linha, 1),
    razaoSocial: texto(linha, 2),
    documento: texto(linha, 3),
    cidade: texto(linha, 4),
    uf: texto(linha, 5),
  }));
}

/**
 * As condições que o representante escolhe, como no SGI6R (1000 a 1349), e as dos cadastros da
 * carteira que ficam fora dessa faixa, para a do cadastro aparecer com o nome.
 */
export async function lerCondicoes(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<CondicaoDoErp[]> {
  const { lista, binds } = bindsDaCarteira(referencia, autorizados);
  const linhas = await oracle.consultar(
    `SELECT A.CPG_COD, TRIM(A.CPG_DES) FROM ABC71.SGI5_VIEW_COND_PAGTO A WHERE A.CPG_COD BETWEEN 1000 AND 1349
     UNION
     SELECT DISTINCT C.COND_PGTO, TRIM(P.EXTENSO_1)
       FROM ABC71.CRCL C JOIN ABC71.CPAG P ON P.COD_PGTO = C.COND_PGTO
      WHERE C.COND_PGTO NOT BETWEEN 1000 AND 1349 AND ${condicaoDaCarteira(lista.sql)}`,
    binds,
  );
  return linhas.map((linha) => ({ codigo: String(numero(linha, 0)), descricao: texto(linha, 1) }));
}

/** As escolhas de cada pedido dos clientes da carteira nos 24 meses, agrupadas: a transportadora, a condição, a classificação e o frete parcial. */
export async function lerEscolhas(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<EscolhasDoErp[]> {
  const { lista, binds } = bindsDaCarteira(referencia, autorizados);
  const linhas = await oracle.consultar(
    `SELECT C.EMP_FIL, C.CLIENTE, A.PV1_TRA, A.PV1_CPG, TRIM(A.PV1_CVE), TRIM(A.PV1_TFR), COUNT(*)
       FROM ABC71.SGI5_TAB_VEN_PV1_V2 A
       JOIN ABC71.CRCL C ON C.CLIENTE = A.PV1_CLI
      WHERE A.PV1_DCA >= ${data("inicio24")} AND ${PEDIDO_QUE_VALEU} AND ${condicaoDaCarteira(lista.sql)}
      GROUP BY C.EMP_FIL, C.CLIENTE, A.PV1_TRA, A.PV1_CPG, TRIM(A.PV1_CVE), TRIM(A.PV1_TFR)`,
    { ...binds, inicio24: referencia.inicio24 },
  );
  return linhas.map((linha) => ({
    chave: chaveDoCliente(numero(linha, 0), numero(linha, 1)),
    transportadora: numero(linha, 2) > 0 ? String(numero(linha, 2)) : null,
    condicao: numero(linha, 3) > 0 ? String(numero(linha, 3)) : null,
    classificacao: textoOuNulo(linha, 4),
    freteParcial: textoOuNulo(linha, 5),
    pedidos: numero(linha, 6),
  }));
}

/** Quantos pedidos de cada representante autorizado foram com cada transportadora, nos 24 meses. */
export async function lerTransportadorasDosRepresentantes(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<UsoDaTransportadora[]> {
  const lista = emLista("r", autorizados);
  const linhas = await oracle.consultar(
    `SELECT A.PV1_VEN, A.PV1_TRA, COUNT(*)
       FROM ABC71.SGI5_TAB_VEN_PV1_V2 A
      WHERE A.PV1_DCA >= ${data("inicio24")} AND ${PEDIDO_QUE_VALEU} AND A.PV1_VEN IN ${lista.sql} AND NVL(A.PV1_TRA, 0) > 0
      GROUP BY A.PV1_VEN, A.PV1_TRA`,
    { ...lista.binds, inicio24: referencia.inicio24 },
  );
  return linhas.map((linha) => ({ representante: String(numero(linha, 0)), transportadora: String(numero(linha, 1)), pedidos: numero(linha, 2) }));
}

/**
 * Os itens do último pedido de cada cliente da carteira nos 24 meses, na ordem do pedido. O número do
 * pedido recomeça depois de 2.999.999: o último é o de data mais recente, e só no empate o de número maior.
 */
export async function lerUltimosPedidos(oracle: Oracle, referencia: Referencia, autorizados: string[]): Promise<UltimoPedidoDoErp[]> {
  const { lista, binds } = bindsDaCarteira(referencia, autorizados);
  const linhas = await oracle.consultar(
    `SELECT P.EMP_FIL, P.CLIENTE, P.DIA, B.PV2_ITE, TRIM(B.PV2_PAC), B.PV2_QTD, TRIM(B.PV2_UNI)
       FROM (SELECT C.EMP_FIL, C.CLIENTE, A.PV1_NPE, TO_CHAR(A.PV1_DCA, 'YYYY-MM-DD') DIA,
                    ROW_NUMBER() OVER (PARTITION BY A.PV1_CLI ORDER BY A.PV1_DCA DESC, A.PV1_NPE DESC) ORDEM
               FROM ABC71.SGI5_TAB_VEN_PV1_V2 A
               JOIN ABC71.CRCL C ON C.CLIENTE = A.PV1_CLI
              WHERE A.PV1_DCA >= ${data("inicio24")} AND ${PEDIDO_QUE_VALEU} AND ${condicaoDaCarteira(lista.sql)}) P
       JOIN ABC71.SGI5_TAB_VEN_PV2_V2 B ON B.PV2_NPE = P.PV1_NPE
      WHERE P.ORDEM = 1
      ORDER BY P.EMP_FIL, P.CLIENTE, B.PV2_ITE`,
    { ...binds, inicio24: referencia.inicio24 },
  );
  return linhas.map((linha) => ({
    chave: chaveDoCliente(numero(linha, 0), numero(linha, 1)),
    dia: texto(linha, 2),
    produto: texto(linha, 4),
    // O item do SGI é sempre em cento (CT) nos 24 meses de 2026-11-17; em peça, fica como está.
    pecas: numero(linha, 5) * (texto(linha, 6) === "CT" ? 100 : 1),
  }));
}
