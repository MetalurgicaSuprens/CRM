import { DURACAO_MAXIMA_MS } from "./sessoes.ts";
import { FORMATO_DO_TOKEN } from "./token.ts";

/*
 * O cookie da sessão (docs/plano.md, "Sessão"). O prefixo __Host- obriga o navegador a só aceitá-lo
 * com Secure, Path=/ e sem Domain: ele não vale em subdomínio nem por http. HttpOnly esconde o token
 * do JavaScript, e SameSite=Strict não o manda em pedido que nasce de outro site.
 */

const NOME = "__Host-crm";
const ATRIBUTOS = "Path=/; HttpOnly; Secure; SameSite=Strict";
const TOKEN = new RegExp(FORMATO_DO_TOKEN);

export const COOKIE_APAGADO = `${NOME}=; Max-Age=0; ${ATRIBUTOS}`;

export function cookieDaSessao(token: string): string {
  return `${NOME}=${token}; Max-Age=${DURACAO_MAXIMA_MS / 1_000}; ${ATRIBUTOS}`;
}

/** O token da sessão no cabeçalho Cookie, ou null; fora do formato, nem chega ao banco. */
export function lerTokenDoCookie(cabecalho: string | undefined): string | null {
  for (const parte of (cabecalho ?? "").split(";")) {
    const [nome, valor] = parte.trim().split("=");
    if (nome === NOME && valor !== undefined && TOKEN.test(valor)) return valor;
  }
  return null;
}
