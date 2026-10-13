import type { Referencia } from "../calculo/referencia.ts";
import type { Oracle } from "../oracle.ts";
import { chaveDoCliente, numero, texto } from "./linha.ts";
import { TIPOS_DE_VENDA, data, representanteDaVenda, textoDaData } from "./sql.ts";
import type { PedidoEmAbertoNoErp } from "./tipos.ts";

/**
 * Valor em aberto do item: saldo × preço, com os descontos do item e a alíquota da Zona Franca do
 * pedido 315 (docs/dados-por-tela.md, Pedidos, "Valor em aberto"; a conferir com a tela do SGI).
 * Saldo e preço estão em cento, então o resultado já sai em R$. Aliases D = VEPD, P = VEPM.
 */
const VALOR_EM_ABERTO_DO_ITEM = `(D.SALDO * D.VLR_UNIT
  * (1 - NVL(D.PORC_DESC, 0) / 100) * (1 - NVL(D.PORC_DESC2, 0) / 100)
  * (1 - NVL(D.PORC_DESC_CLI, 0) / 100) * (1 - NVL(D.PORC_DESC_CPAG, 0) / 100)
  * (1 - NVL(P.Z_FRANCA_DESC, 0) / 100))`;

const ENTREGA_DO_ITEM = "NVL(D.DT_ENTREGA, P.DT_ENTREGA)";

/**
 * Todos os pedidos do Omega com saldo nos tipos de venda e sem bloqueio, de qualquer representante:
 * o cliente com pedido em aberto não conta como parado, venha o pedido de quem vier.
 */
export async function lerPedidosEmAberto(oracle: Oracle, referencia: Referencia): Promise<PedidoEmAbertoNoErp[]> {
  const representante = representanteDaVenda("P.VENDEDOR");
  const linhas = await oracle.consultar(
    `SELECT P.NUMERO, P.EMP_FIL, P.CLIENTE, ${representante}, ${textoDaData("P.DT_PED")},
            ${textoDaData(`MIN(${ENTREGA_DO_ITEM})`)}, COUNT(*), SUM(${VALOR_EM_ABERTO_DO_ITEM}),
            SUM(CASE WHEN ${ENTREGA_DO_ITEM} < ${data("fimDoMes")} + 1 THEN ${VALOR_EM_ABERTO_DO_ITEM} ELSE 0 END)
       FROM ABC71.VEPM P
       JOIN ABC71.VEPD D ON D.EMP_FIL = P.EMP_FIL AND D.NUMERO = P.NUMERO
       LEFT JOIN ABC71.CRCL C ON C.EMP_FIL = P.EMP_FIL AND C.CLIENTE = P.CLIENTE
      WHERE D.SALDO > 0 AND D.TIPO_MOVTO IN (${TIPOS_DE_VENDA}) AND NVL(TRIM(P.BLOQUEADO), 'N') <> 'S'
      GROUP BY P.NUMERO, P.EMP_FIL, P.CLIENTE, ${representante}, P.DT_PED`,
    { fimDoMes: referencia.fimDoMesAtual },
  );
  return linhas.map((linha) => ({
    pedido: String(numero(linha, 0)),
    chave: chaveDoCliente(numero(linha, 1), numero(linha, 2)),
    representante: String(numero(linha, 3)),
    emissao: texto(linha, 4),
    entrega: texto(linha, 5),
    itens: numero(linha, 6),
    valor: numero(linha, 7),
    valorEntregaNoMes: numero(linha, 8),
  }));
}
