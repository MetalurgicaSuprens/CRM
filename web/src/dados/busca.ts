import { normalizarParaBusca } from "../formato";
import type { ClienteResumo, ProdutoDoCatalogo } from "./tipos";

/*
 * A busca de cliente, pelo nome ou pelo CNPJ, e a do catálogo do pedido. O código do ERP da empresa é
 * a raiz do CNPJ e a filial, sem os dois dígitos verificadores, e perde os zeros da esquerda, porque no
 * ERP ele é um número: 01.116.500/0001 vira 11165000001 (61 dos 178 clientes da Star Vendas, em 2026-10-15).
 */

/** Só dígitos e a pontuação do CNPJ: a busca é pelo CNPJ. */
const SO_CNPJ = /^[\d./\s-]+$/;
const DIGITOS_DA_RAIZ_E_FILIAL = 12;

/** Pelo nome fantasia ou pelo CNPJ, com ou sem pontuação e verificadores. A pessoa física, que não tem CNPJ, só pelo nome. */
export function correspondeAoCliente(cliente: Pick<ClienteResumo, "nome" | "codigoErp">, busca: string): boolean {
  const termo = busca.trim();
  if (!termo) return true;
  if (SO_CNPJ.test(termo)) return correspondeAoCnpj(cliente.codigoErp, termo);
  return normalizarParaBusca(cliente.nome).includes(normalizarParaBusca(termo));
}

/** O que a busca olha do cliente e, no grupo, de cada CNPJ dele. */
type ClienteDaBusca = Pick<ClienteResumo, "nome" | "codigoErp" | "cidade"> & { cnpjs: readonly ClienteDaBusca[] | null };

/**
 * Como `correspondeAoCliente`, e também pela cidade; o grupo, também pelo nome, pelo CNPJ ou pela
 * cidade de qualquer CNPJ dele. É a busca de Clientes e da escolha do cliente do pedido.
 */
export function correspondeAoClienteOuCidade(cliente: ClienteDaBusca, busca: string): boolean {
  return (
    correspondeAoCliente(cliente, busca) ||
    normalizarParaBusca(cliente.cidade).includes(normalizarParaBusca(busca.trim())) ||
    (cliente.cnpjs ?? []).some((cnpj) => correspondeAoClienteOuCidade(cnpj, busca))
  );
}

/** O produto do catálogo pelo código, pela família, pela medida ou por qualquer part number dele. */
export function correspondeAoProduto(produto: Pick<ProdutoDoCatalogo, "codigo" | "familia" | "medida" | "partNumbers">, busca: string): boolean {
  const termo = normalizarParaBusca(busca.trim());
  if (!termo) return true;
  const nosCampos = [produto.codigo, produto.familia, produto.medida ?? ""].some((campo) => normalizarParaBusca(campo).includes(termo));
  return nosCampos || partNumberDaBusca(produto.partNumbers, busca) !== null;
}

/**
 * O part number que a busca acha, com ou sem pontos, traços e espaços: o cliente passa o código da
 * montadora escrito de vários jeitos. Null quando ela não acha nenhum.
 */
export function partNumberDaBusca(partNumbers: readonly string[], busca: string): string | null {
  const termo = soLetrasEDigitos(busca);
  if (!termo) return null;
  return partNumbers.find((partNumber) => soLetrasEDigitos(partNumber).includes(termo)) ?? null;
}

function soLetrasEDigitos(texto: string): string {
  return normalizarParaBusca(texto).replace(/[^a-z0-9]/g, "");
}

function correspondeAoCnpj(codigoErp: string | null, termo: string): boolean {
  if (codigoErp === null) return false;
  const digitos = termo.replace(/\D/g, "").slice(0, DIGITOS_DA_RAIZ_E_FILIAL);
  return codigoErp.padStart(DIGITOS_DA_RAIZ_E_FILIAL, "0").includes(digitos);
}
