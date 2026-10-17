import { irParaAEntrada, mensagemDeErro } from "../dados/http";
import type {
  ConviteGerado,
  DetalheDoLogin,
  LoginNaGestao,
  ListaDeAutorizados,
  PaginaDoRegistro,
  SituacaoDaAdministracao,
} from "./tipos";

/*
 * As chamadas da administração à API dela (server/src/admin/rotasDoAdmin.ts), na mesma origem. Sem
 * a sessão do admin, volta para a entrada da administração; a recusa de uma ação traz a mensagem do
 * servidor, para a tela mostrar.
 */

export const carregarSituacao = () => ler<SituacaoDaAdministracao>("/api/admin/situacao");
export const carregarLogins = () => ler<LoginNaGestao[]>("/api/admin/logins");
export const carregarLogin = (id: string) => ler<DetalheDoLogin>(`/api/admin/logins/${encodeURIComponent(id)}`);
export const carregarRepresentantes = () => ler<ListaDeAutorizados>("/api/admin/representantes");

export function carregarRegistro({ antes, login }: { antes?: number; login?: string } = {}): Promise<PaginaDoRegistro> {
  const busca = new URLSearchParams();
  if (antes !== undefined) busca.set("antes", String(antes));
  if (login) busca.set("login", login);
  return ler(`/api/admin/registro${busca.size > 0 ? `?${busca.toString()}` : ""}`);
}

export const criarLogin = (novo: { nome: string; codigos: string[] }) => postar<ConviteGerado>("/api/admin/logins", novo);
export const gerarConvite = (id: string) => postar<ConviteGerado>(`/api/admin/logins/${encodeURIComponent(id)}/convite`);
export const trocarCodigos = (id: string, codigos: string[]) => postar<{ codigos: string[] }>(`/api/admin/logins/${encodeURIComponent(id)}/codigos`, { codigos });
export const bloquearChaves = (id: string) => postar<{ bloqueadas: number }>(`/api/admin/logins/${encodeURIComponent(id)}/bloquear-chaves`);
export const encerrarSessoes = (id: string) => postar<{ encerradas: number }>(`/api/admin/logins/${encodeURIComponent(id)}/encerrar-sessoes`);
export const desativarLogin = (id: string) => postar<void>(`/api/admin/logins/${encodeURIComponent(id)}/desativar`);
export const bloquearChave = (id: string) => postar<void>(`/api/admin/chaves/${encodeURIComponent(id)}/bloquear`);

async function ler<T>(caminho: string): Promise<T> {
  const resposta = await fetch(caminho, { headers: { Accept: "application/json" } });
  if (resposta.status === 401) return irParaAEntrada(resposta);
  if (!resposta.ok) throw new Error(await mensagemDeErro(resposta));
  return (await resposta.json()) as T;
}

async function postar<T>(caminho: string, corpo?: object): Promise<T> {
  const resposta = await fetch(caminho, {
    method: "POST",
    headers: corpo ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (resposta.status === 401) return irParaAEntrada(resposta);
  if (!resposta.ok) throw new Error(await mensagemDeErro(resposta));
  return resposta.status === 204 ? (undefined as T) : ((await resposta.json()) as T);
}
