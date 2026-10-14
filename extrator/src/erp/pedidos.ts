import type { Linha, Oracle } from "../oracle.ts";
import { chaveDoCliente, numero, texto, textoOuNulo } from "./linha.ts";
import { FAMILIA_DO_ITEM, TIPOS_DE_VENDA, emPecas, representanteDaVenda, textoDaData } from "./sql.ts";
import type { PedidoEmAbertoNoErp } from "./tipos.ts";

/**
 * Valor em aberto do item: saldo × preço, com os descontos do item e a alíquota da Zona Franca do
 * pedido 315 (docs/dados-por-tela.md, Pedidos, "Valor em aberto"; a conferir com a tela do SGI).
 * Saldo e preço estão na mesma unidade, então o resultado já sai em R$. Aliases D = VEPD, M = VEPM.
 */
const VALOR_EM_ABERTO_DO_ITEM = `(D.SALDO * D.VLR_UNIT
  * (1 - NVL(D.PORC_DESC, 0) / 100) * (1 - NVL(D.PORC_DESC2, 0) / 100)
  * (1 - NVL(D.PORC_DESC_CLI, 0) / 100) * (1 - NVL(D.PORC_DESC_CPAG, 0) / 100)
  * (1 - NVL(M.Z_FRANCA_DESC, 0) / 100))`;

const ENTREGA_DO_ITEM = "NVL(D.DT_ENTREGA, M.DT_ENTREGA)";

/**
 * Os itens com saldo dos pedidos do Omega nos tipos de venda e sem bloqueio, de qualquer
 * representante: o cliente com pedido em aberto não conta como parado, venha o pedido de quem vier.
 */
export async function lerPedidosEmAberto(oracle: Oracle): Promise<PedidoEmAbertoNoErp[]> {
  const representante = representanteDaVenda("M.VENDEDOR");
  const linhas = await oracle.consultar(
    `SELECT M.EMP_FIL, M.NUMERO, M.CLIENTE, ${representante}, ${textoDaData("M.DT_PED")},
            TRIM(D.C_PROD), TRIM(G.GRP_DES), ${emPecas("D.SALDO")}, ${textoDaData(ENTREGA_DO_ITEM)}, ${VALOR_EM_ABERTO_DO_ITEM}
       FROM ABC71.VEPM M
       JOIN ABC71.VEPD D ON D.EMP_FIL = M.EMP_FIL AND D.NUMERO = M.NUMERO
       LEFT JOIN ABC71.CRCL C ON C.EMP_FIL = M.EMP_FIL AND C.CLIENTE = M.CLIENTE
     ${FAMILIA_DO_ITEM}
      WHERE D.SALDO > 0 AND D.TIPO_MOVTO IN (${TIPOS_DE_VENDA}) AND NVL(TRIM(M.BLOQUEADO), 'N') <> 'S'
      ORDER BY M.EMP_FIL, M.NUMERO, D.SEQUENCIA`,
  );
  return agruparPorPedido(linhas);
}

/** Uma linha por item, na ordem do pedido; o cabeçalho se repete em cada uma. */
function agruparPorPedido(linhas: Linha[]): PedidoEmAbertoNoErp[] {
  const pedidos = new Map<string, PedidoEmAbertoNoErp>();
  for (const linha of linhas) {
    const chaveDoPedido = `${numero(linha, 0)}/${numero(linha, 1)}`;
    const pedido = pedidos.get(chaveDoPedido) ?? {
      pedido: String(numero(linha, 1)),
      chave: chaveDoCliente(numero(linha, 0), numero(linha, 2)),
      representante: String(numero(linha, 3)),
      emissao: texto(linha, 4),
      itens: [],
    };
    pedido.itens.push({
      produto: texto(linha, 5),
      familia: textoOuNulo(linha, 6),
      pecas: numero(linha, 7),
      entrega: texto(linha, 8),
      valor: numero(linha, 9),
    });
    pedidos.set(chaveDoPedido, pedido);
  }
  return [...pedidos.values()];
}
