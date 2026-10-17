import type { Referencia } from "../calculo/referencia.ts";
import type { Oracle } from "../oracle.ts";
import { mercadoDoTipoDeCliente } from "./carteira.ts";
import { chaveDoCliente, numero, texto, textoOuNulo } from "./linha.ts";
import { FAMILIA_DO_ITEM, ITENS_DAS_NOTAS, NOTA_DE_VENDA, PECAS_DO_ITEM, VALOR_DO_ITEM, data, emLista, textoDaData } from "./sql.ts";
import type { FamiliaDoCliente, ProdutoDoCliente } from "./tipos.ts";

/**
 * Faturado por cliente e família nos 24 meses fechados, de toda a Suprens: base do mix. Fica na
 * LAN; a foto leva só as famílias sugeridas e as da carteira.
 */
export async function lerFamiliasDaSuprens(oracle: Oracle, referencia: Referencia): Promise<FamiliaDoCliente[]> {
  const linhas = await oracle.consultar(
    `SELECT M.EMP_FIL, M.FORNEC, MAX(TRIM(C.TIPO_CLI)), TRIM(G.GRP_DES),
            SUM(CASE WHEN M.DT_EMISSAO >= ${data("inicio12")} THEN ${VALOR_DO_ITEM} ELSE 0 END),
            SUM(${VALOR_DO_ITEM})
     ${ITENS_DAS_NOTAS}
       LEFT JOIN ABC71.CRCL C ON C.EMP_FIL = M.EMP_FIL AND C.CLIENTE = M.FORNEC
     ${FAMILIA_DO_ITEM}
      WHERE ${NOTA_DE_VENDA}
        AND M.DT_EMISSAO >= ${data("inicio24")} AND M.DT_EMISSAO < ${data("inicioDoMesAtual")}
      GROUP BY M.EMP_FIL, M.FORNEC, TRIM(G.GRP_DES)`,
    { inicio12: referencia.inicio12, inicio24: referencia.inicio24, inicioDoMesAtual: referencia.inicioDoMesAtual },
  );
  return linhas.map((linha) => ({
    chave: chaveDoCliente(numero(linha, 0), numero(linha, 1)),
    mercado: mercadoDoTipoDeCliente(textoOuNulo(linha, 2)),
    familia: textoOuNulo(linha, 3),
    valor12m: numero(linha, 4),
    valor24m: numero(linha, 5),
  }));
}

/**
 * Os produtos que cada cliente da carteira comprou nos 12 meses fechados. Vêm todos, e não só os
 * 8 que a ficha mostra, porque os 8 de um grupo saem da soma dos CNPJs dele (calculo/clientes.ts).
 */
export async function lerProdutosDoAno(
  oracle: Oracle,
  referencia: Referencia,
  autorizados: string[],
): Promise<ProdutoDoCliente[]> {
  const lista = emLista("r", autorizados);
  const linhas = await oracle.consultar(
    `SELECT M.EMP_FIL, M.FORNEC, TRIM(D.C_PROD), MAX(TRIM(G.GRP_DES)),
            SUM(${PECAS_DO_ITEM}), SUM(${VALOR_DO_ITEM}), ${textoDaData("MAX(M.DT_EMISSAO)")}
     ${ITENS_DAS_NOTAS}
       JOIN ABC71.CRCL C ON C.EMP_FIL = M.EMP_FIL AND C.CLIENTE = M.FORNEC
     ${FAMILIA_DO_ITEM}
      WHERE ${NOTA_DE_VENDA} AND C.VEND_1 IN ${lista.sql}
        AND M.DT_EMISSAO >= ${data("inicio12")} AND M.DT_EMISSAO < ${data("inicioDoMesAtual")}
      GROUP BY M.EMP_FIL, M.FORNEC, TRIM(D.C_PROD)`,
    { ...lista.binds, inicio12: referencia.inicio12, inicioDoMesAtual: referencia.inicioDoMesAtual },
  );
  return linhas.map((linha) => ({
    chave: chaveDoCliente(numero(linha, 0), numero(linha, 1)),
    produto: texto(linha, 2),
    familia: textoOuNulo(linha, 3),
    pecas: numero(linha, 4),
    valor: numero(linha, 5),
    ultimaCompra: texto(linha, 6),
  }));
}
