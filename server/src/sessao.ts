import type { FastifyRequest } from "fastify";

/** Quem está usando o CRM e os códigos de representante que o login dele puxa. */
export type Sessao = {
  /** Só o id vai para o log, nunca o nome. */
  idDoUsuario: string;
  nome: string;
  codigos: string[];
};

/** De onde vem a sessão de cada requisição. Na F3, do cookie conferido no app.db. */
export type FonteDeSessao = (requisicao: FastifyRequest) => Sessao | null;

const ENDERECOS_DESTE_COMPUTADOR = new Set(["localhost", "127.0.0.1"]);

/**
 * Login fixo para ver os dados reais neste computador enquanto o login de verdade (F3) não existe.
 * Só vale para quem chama o servidor pelo endereço local: um pedido que chega pelo Apache, com o
 * domínio do CRM, fica sem sessão.
 */
export function sessaoDeTeste(nome: string, codigos: string[]): FonteDeSessao {
  const sessao: Sessao = { idDoUsuario: "sessao-de-teste", nome, codigos };
  return (requisicao) => (ENDERECOS_DESTE_COMPUTADOR.has(requisicao.hostname) ? sessao : null);
}
