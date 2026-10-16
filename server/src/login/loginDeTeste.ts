import type { DatabaseSync } from "node:sqlite";
import { gravarChave } from "./chaves.ts";
import { cookieDaSessao } from "./cookie.ts";
import { PORTAL_DO_ADMIN, PORTAL_DO_CRM, type Portal } from "./portal.ts";
import { abrirSessao } from "./sessoes.ts";
import { criarAdmin, criarUsuario, type Usuario } from "./usuarios.ts";

/*
 * Para os testes das rotas: um login com uma chave já gravada e a sessão aberta. Devolve o
 * cabeçalho Cookie da sessão. A chave de acesso em si é testada em login.test.ts.
 */

/** Um representante com os códigos, no CRM. */
export function entrarComo(banco: DatabaseSync, codigos: string[], agora = new Date()): string {
  const usuario = criarUsuario(banco, { nome: `Teste ${codigos.join(" e ")}`, codigos, autorizados: new Set(codigos), ligadoPor: "teste" }, agora);
  return abrirSessaoDeTeste(banco, usuario, PORTAL_DO_CRM, agora);
}

/** Um admin, na administração. */
export function entrarComoAdmin(banco: DatabaseSync, agora = new Date()): { cookie: string; admin: Usuario } {
  const admin = criarAdmin(banco, { nome: "Admin de teste" }, agora);
  return { cookie: abrirSessaoDeTeste(banco, admin, PORTAL_DO_ADMIN, agora), admin };
}

/** "nome=valor" do Set-Cookie, para mandar de volta no Cookie. */
export function cabecalhoDoCookie(portal: Portal, token: string): string {
  return cookieDaSessao(portal.cookie, token).split(";")[0] ?? "";
}

function abrirSessaoDeTeste(banco: DatabaseSync, usuario: Usuario, portal: Portal, agora: Date): string {
  const chave = `chave-de-${usuario.id}`;
  gravarChave(
    banco,
    { id: chave, usuario: usuario.id, chavePublica: new Uint8Array(65), contador: 0, transportes: [], aaguid: "00000000-0000-0000-0000-000000000000", sincronizada: false },
    agora,
  );
  return cabecalhoDoCookie(portal, abrirSessao(banco, { usuario: usuario.id, chave }, agora));
}
