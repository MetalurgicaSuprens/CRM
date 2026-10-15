import type { DatabaseSync } from "node:sqlite";
import { gravarChave } from "./chaves.ts";
import { cookieDaSessao } from "./cookie.ts";
import { abrirSessao } from "./sessoes.ts";
import { criarUsuario } from "./usuarios.ts";

/**
 * Para os testes das rotas de dados: um login com os códigos, uma chave já gravada e a sessão
 * aberta. Devolve o cabeçalho Cookie da sessão. A chave de acesso em si é testada em login.test.ts.
 */
export function entrarComo(banco: DatabaseSync, codigos: string[], agora = new Date()): string {
  const usuario = criarUsuario(banco, { nome: `Teste ${codigos.join(" e ")}`, codigos, autorizados: new Set(codigos), ligadoPor: "teste" }, agora);
  const chave = `chave-de-${usuario.id}`;
  gravarChave(
    banco,
    { id: chave, usuario: usuario.id, chavePublica: new Uint8Array(65), contador: 0, transportes: [], aaguid: "00000000-0000-0000-0000-000000000000", sincronizada: false },
    agora,
  );
  return cabecalhoDoCookie(abrirSessao(banco, { usuario: usuario.id, chave }, agora));
}

/** "nome=valor" do Set-Cookie, para mandar de volta no Cookie. */
export function cabecalhoDoCookie(token: string): string {
  return cookieDaSessao(token).split(";")[0] ?? "";
}
