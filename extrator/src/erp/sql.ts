/*
 * Pedaços de SQL que as leituras compartilham. Faturamento pela regra do Gestao/RELCUS001
 * (docs/plano.md, "Faturamento"; Gestao/server/src/producao/foto/moduloVendasEntradas.ts).
 */

export const TIPOS_DE_VENDA = "310, 315, 316, 317, 320, 325, 326";

/** Valor do item da nota sem o desconto da Zona Franca, como o RELCUS001. Alias D = NFDE. */
export const VALOR_DO_ITEM = "(D.VLR_TOTAL - NVL(D.Z_FRANCA_DESC, 0))";

/**
 * A única conversão de unidade do extrator: a quantidade do item vem em cento (CT), que vira ×100,
 * ou em peça. Alias D = NFDE ou VEPD, que têm a mesma coluna UNIDADE.
 */
export function emPecas(quantidade: string): string {
  return `(${quantidade} * CASE TRIM(D.UNIDADE) WHEN 'CT' THEN 100 ELSE 1 END)`;
}

/** Peças do item da nota. Alias D = NFDE. */
export const PECAS_DO_ITEM = emPecas("D.QTDE");

/** Itens das notas com o cabeçalho, pela chave inteira. Aliases D = NFDE e M = NFME. */
export const ITENS_DAS_NOTAS = `
  FROM ABC71.NFDE D
  JOIN ABC71.NFME M
    ON M.EMP_FIL = D.EMP_FIL AND M.N_FISCAL = D.N_FISCAL AND M.SERIE = D.SERIE
   AND M.FORNEC = D.FORNEC AND M.TIPO_MOVTO = D.TIPO_MOVTO`;

/** Nota de venda que não foi cancelada. Alias M = NFME. */
export const NOTA_DE_VENDA = `M.TIPO_MOVTO IN (${TIPOS_DE_VENDA}) AND NVL(TRIM(M.ID_CANCEL), 'N') <> 'S'`;

/**
 * Representante da venda: o vendedor da nota (ou do pedido) e, sem ele, o dono atual do cliente.
 * Alias C = CRCL. O plano pede o dono na data pelo CRCLH; nenhuma nota dos últimos 36 meses veio
 * sem vendedor (contagem de 2026-10-13), e o CRCLH entra quando isso mudar.
 */
export function representanteDaVenda(vendedor: string): string {
  return `NVL(NULLIF(${vendedor}, 0), C.VEND_1)`;
}

/** Família do produto do item: o grupo de custo de nível 2. Aliases D = NFDE ou VEPD, P e G novos. */
export const FAMILIA_DO_ITEM = `
  LEFT JOIN ABC71.SGI5_TAB_ENG_PAC P ON TRIM(P.PAC_COD) = TRIM(D.C_PROD)
  LEFT JOIN ABC71.SGI5_TAB_CUS_V3_GRP G ON G.GRP_GRP = P.PAC_GRC`;

/** Data ISO (ou mês) feita no Oracle, para o fuso não deslocar o dia. */
export function textoDaData(expressao: string, formato: "YYYY-MM-DD" | "YYYY-MM" = "YYYY-MM-DD"): string {
  return `TO_CHAR(${expressao}, '${formato}')`;
}

export function data(variavel: string): string {
  return `TO_DATE(:${variavel}, 'YYYY-MM-DD')`;
}

/** `IN (:r0, :r1, ...)` com uma variável por código: o SQL nunca leva valor escrito nele. */
export function emLista(prefixo: string, codigos: readonly string[]): { sql: string; binds: Record<string, number> } {
  const binds = Object.fromEntries(codigos.map((codigo, i) => [`${prefixo}${i}`, Number(codigo)]));
  return { sql: `(${Object.keys(binds).map((nome) => `:${nome}`).join(", ")})`, binds };
}
