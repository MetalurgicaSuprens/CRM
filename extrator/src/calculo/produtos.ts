import type { Foto } from "dominio/esquemaDaFoto";

/** O nome do produto sem grupo de custo, nas telas e nas contas do mix. */
export const SEM_FAMILIA = "SEM FAMÍLIA";

/**
 * Acrescenta ao dicionário de produtos os que faltam, só com a família: a medida e a embalagem vêm
 * só do catálogo, que entra primeiro.
 */
export function juntarProdutos(produtos: Foto["produto"], outros: readonly { produto: string; familia: string | null }[]): Foto["produto"] {
  const porCodigo = new Map(produtos.map((produto) => [produto.produto, produto]));
  for (const { produto, familia } of outros) {
    if (!porCodigo.has(produto)) porCodigo.set(produto, { produto, familia: familia ?? SEM_FAMILIA, medida: null, embalagem: null });
  }
  return [...porCodigo.values()];
}
