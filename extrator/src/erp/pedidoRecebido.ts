import type { Mercado } from "dominio/tipos";
import type { TransportadoraDoPedido } from "dominio/conteudoDoPedido";
import type { Oracle } from "../oracle.ts";
import { mercadoDoTipoDeCliente } from "./carteira.ts";
import { documento } from "./dadosDoPedido.ts";
import { numero, texto, textoOuNulo } from "./linha.ts";
import { emLista } from "./sql.ts";

/*
 * O que a conferência de um pedido do CRM lê no Oracle, na hora, antes de o pedido seguir para o SGI
 * (pedidos/conferencia.ts): os clientes dos códigos do login, a condição de pagamento e a
 * transportadora. As tabelas e os preços vêm das mesmas consultas da foto (catalogo.ts).
 */

export type ClienteNoErp = {
  empresa: number;
  cliente: number;
  /** O VEND_1: o dono do cliente, que vai no pedido do SGI, nunca escolhido pelo navegador. */
  vendedor: string;
  /** O CLI3_STA como está no SGI; vazio conta como ATIVO. */
  statusNoSgi: string | null;
  condicaoDoCadastro: string | null;
  mercado: Mercado;
};

/** As condições que o representante escolhe no SGI6R, como na foto (dadosDoPedido.ts, lerCondicoes). */
const FAIXA_DAS_CONDICOES = "BETWEEN 1000 AND 1349";

/** Os clientes cujo dono (VEND_1) é um dos códigos. Quem acha o do pedido é o id opaco, calculado aqui. */
export async function lerClientesDosCodigos(oracle: Oracle, codigos: readonly string[]): Promise<ClienteNoErp[]> {
  const lista = emLista("r", codigos);
  const linhas = await oracle.consultar(
    `SELECT C.EMP_FIL, C.CLIENTE, C.VEND_1, TRIM(G.CLI3_STA), C.COND_PGTO, TRIM(C.TIPO_CLI)
       FROM ABC71.CRCL C
       LEFT JOIN ABC71.SGI5_TAB_VEN_CLI3 G ON G.CLI3_CLI = C.CLIENTE
      WHERE C.VEND_1 IN ${lista.sql}`,
    lista.binds,
  );
  return linhas.map((linha) => ({
    empresa: numero(linha, 0),
    cliente: numero(linha, 1),
    vendedor: String(numero(linha, 2)),
    statusNoSgi: textoOuNulo(linha, 3),
    condicaoDoCadastro: numero(linha, 4) > 0 ? String(numero(linha, 4)) : null,
    mercado: mercadoDoTipoDeCliente(textoOuNulo(linha, 5)),
  }));
}

export async function isCondicaoDaFaixa(oracle: Oracle, condicao: string): Promise<boolean> {
  const [linha] = await oracle.consultar(`SELECT COUNT(*) FROM ABC71.SGI5_VIEW_COND_PAGTO A WHERE A.CPG_COD = :condicao AND A.CPG_COD ${FAIXA_DAS_CONDICOES}`, {
    condicao: Number(condicao),
  });
  return linha !== undefined && numero(linha, 0) > 0;
}

/**
 * O código da transportadora ativa no ERP, como o SGI6R a lista (lerTransportadoras): a escolhida, se
 * existe, ou a nova, se vendas já a cadastrou com o CNPJ; null quando não há.
 */
export async function lerTransportadoraDoPedido(oracle: Oracle, transportadora: NonNullable<TransportadoraDoPedido>): Promise<string | null> {
  const [condicao, binds] =
    "codigo" in transportadora
      ? ["A.FORNEC = :valor", { valor: Number(transportadora.codigo) }]
      : [`${documento("A", "TRIM(A.FIS_JURID)")} = :valor`, { valor: transportadora.nova.cnpj }];
  const linhas = await oracle.consultar(
    `SELECT MIN(A.FORNEC) FROM ABC71.CFOR A
      WHERE TRIM(A.TIPO_FORN) = 'T' AND NVL(TRIM(A.NOME_FANTAS), ' ') NOT LIKE '%INATIVO%' AND ${condicao}`,
    binds,
  );
  const [linha] = linhas;
  return linha && texto(linha, 0) !== "" ? String(numero(linha, 0)) : null;
}
