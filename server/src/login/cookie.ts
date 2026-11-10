import { DURACAO_MAXIMA_MS } from "./sessoes.ts";
import { FORMATO_DO_TOKEN } from "./token.ts";

/*
 * O cookie da sessão (docs/plano.md, "Sessão"), com o nome do portal (portal.ts). O prefixo __Host-
 * obriga o navegador a só aceitá-lo com Secure, Path=/ e sem Domain: ele não vale em subdomínio nem
 * por http. HttpOnly esconde o token do JavaScript, e SameSite=Strict não o manda em pedido que nasce
 * de outro site.
 * O cookie sem o prefixo é só o do login provisório da rede interna (loginProvisorio.ts): o endereço
 * dela é http, e o navegador não guarda cookie Secure de http fora de localhost.
 */

const ATRIBUTOS = "Path=/; HttpOnly; SameSite=Strict";
const PREFIXO_SEGURO = "__Host-";
const TOKEN = new RegExp(FORMATO_DO_TOKEN);

export function cookieDaSessao(nome: string, token: string): string {
  return `${nome}=${token}; Max-Age=${DURACAO_MAXIMA_MS / 1_000}; ${atributosDo(nome)}`;
}

export function cookieApagado(nome: string): string {
  return `${nome}=; Max-Age=0; ${atributosDo(nome)}`;
}

/** O prefixo __Host- só vale com Secure; os portais da internet sempre o usam. */
function atributosDo(nome: string): string {
  return nome.startsWith(PREFIXO_SEGURO) ? `${ATRIBUTOS}; Secure` : ATRIBUTOS;
}

/** O token da sessão no cabeçalho Cookie, ou null; fora do formato, nem chega ao banco. */
export function lerTokenDoCookie(nome: string, cabecalho: string | undefined): string | null {
  for (const parte of (cabecalho ?? "").split(";")) {
    const [nomeDoCookie, valor] = parte.trim().split("=");
    if (nomeDoCookie === nome && valor !== undefined && TOKEN.test(valor)) return valor;
  }
  return null;
}
