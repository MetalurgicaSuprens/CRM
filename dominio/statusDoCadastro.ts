import type { StatusDoCadastro } from "./tipos.ts";

/*
 * O status do cliente no cadastro do SGI decide se ele recebe pedido pelo CRM. Fora de ativo, ele
 * continua na carteira, com o status à mostra, mas o pedido fica bloqueado (decisões do Lucas em
 * 2026-10-14 e 2026-10-15).
 */

export type StatusForaDeAtivo = Exclude<StatusDoCadastro, "ativo">;

export function podeReceberPedido(status: StatusDoCadastro): status is "ativo" {
  return status === "ativo";
}

/** O que o representante vê ao tentar um pedido para o cliente fora de ativo. */
/** O cliente sem a tabela de preço principal em real, que o SGI6R também não deixa receber pedido (decisão do Lucas em 2026-11-19). */
export const AVISO_DE_SEM_TABELA =
  "Tabela de preço não cadastrada para este cliente. Para fazer um pedido, fale com a equipe de vendas da Suprens e peça o cadastro da tabela principal.";

export const AVISO_DE_PEDIDO_BLOQUEADO: Record<StatusForaDeAtivo, string> = {
  inativo:
    "Este cliente está inativo no cadastro da Suprens. Para fazer um pedido, fale com a equipe de vendas da Suprens e peça a reativação.",
  substituido:
    "Este cliente foi substituído por outro código no cadastro da Suprens. Para fazer um pedido, fale com a equipe de vendas da Suprens.",
};
