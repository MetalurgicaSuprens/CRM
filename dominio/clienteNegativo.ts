/*
 * Cliente negativo: o que não está ATIVO no cadastro do SGI (decisão do Lucas em 2026-10-14). Ele
 * continua na carteira do representante, com o selo "Negativo", mas não recebe pedido pelo CRM.
 */

/**
 * Pelo status do SGI (`SGI5_TAB_VEN_CLI3.CLI3_STA`; sem linha, vale ATIVO, como no próprio SGI).
 * Além do INATIVO, conta o SUBSTITUIDO: o código foi trocado por outro, e o pedido não deve ir para ele.
 */
export function isClienteNegativo(statusNoSgi: string | null): boolean {
  return (statusNoSgi ?? "ATIVO") !== "ATIVO";
}

export const AVISO_DE_CLIENTE_NEGATIVO =
  "Este cliente está negativo no cadastro da Suprens. Para fazer um pedido, fale com a equipe de vendas da Suprens e peça a reativação dele.";
