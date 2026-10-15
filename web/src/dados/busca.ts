import { normalizarParaBusca } from "../formato";
import type { ClienteResumo } from "./tipos";

/*
 * A busca de cliente, pelo nome ou pelo CNPJ. O código do ERP da empresa é a raiz do CNPJ e a filial,
 * sem os dois dígitos verificadores, e perde os zeros da esquerda, porque no ERP ele é um número:
 * 01.116.500/0001 vira 11165000001 (61 dos 178 clientes da Star Vendas, em 2026-10-15).
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

/** Como `correspondeAoCliente`, e também pela cidade: a busca de Clientes e da escolha do cliente do pedido. */
export function correspondeAoClienteOuCidade(cliente: Pick<ClienteResumo, "nome" | "codigoErp" | "cidade">, busca: string): boolean {
  return correspondeAoCliente(cliente, busca) || normalizarParaBusca(cliente.cidade).includes(normalizarParaBusca(busca.trim()));
}

function correspondeAoCnpj(codigoErp: string | null, termo: string): boolean {
  if (codigoErp === null) return false;
  const digitos = termo.replace(/\D/g, "").slice(0, DIGITOS_DA_RAIZ_E_FILIAL);
  return codigoErp.padStart(DIGITOS_DA_RAIZ_E_FILIAL, "0").includes(digitos);
}
