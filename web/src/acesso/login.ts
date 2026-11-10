import { carregarSituacaoDosDados, isDadosReais } from "../dados/api";
import { mensagemDeErro } from "../dados/http";
import { criarChave, usarChave, type OpcoesDeCriacaoJSON, type OpcoesDeEntradaJSON } from "./chaveDeAcesso";

/*
 * Entrar, criar a chave pelo convite e sair. No modo "real", com a chave de acesso de verdade e a
 * sessão do servidor (server/src/login); no protótipo, simulado, como sempre foi.
 */

export type ConsultaDoConvite =
  | { estado: "valido"; nome: string; validoAte: string }
  /** "trocado": o admin mandou um convite mais novo; "invalido": o link veio cortado ou não existe. */
  | { estado: "expirado" | "usado" | "trocado" | "invalido" };

export type Login = {
  entrar(): Promise<void>;
  consultarConvite(token: string): Promise<ConsultaDoConvite>;
  criarChaveDoConvite(token: string): Promise<void>;
  sair(): Promise<void>;
};

/** 32 bytes em base64url: o formato do token do convite (server/src/login/token.ts). */
const TOKEN_DO_CONVITE = /^[A-Za-z0-9_-]{43}$/;
const VALIDADE_SIMULADA_MS = 48 * 60 * 60 * 1_000;
const ESPERA_SIMULADA_MS = 1_200;

const loginDoServidor: Login = {
  async entrar() {
    const opcoes = await postar<OpcoesDeEntradaJSON>("/api/entrar/opcoes", {});
    await postar("/api/entrar", { resposta: await usarChave(opcoes) });
  },
  consultarConvite: (token) =>
    TOKEN_DO_CONVITE.test(token) ? postar<ConsultaDoConvite>("/api/convite/consultar", { token }) : Promise.resolve({ estado: "invalido" }),
  async criarChaveDoConvite(token) {
    const opcoes = await postar<OpcoesDeCriacaoJSON>("/api/convite/opcoes", { token });
    await postar("/api/convite/chave", { token, resposta: await criarChave(opcoes) });
  },
  async sair() {
    await postar("/api/sair");
  },
};

/** No protótipo, o próprio token escolhe o estado do convite: #expirado, #usado, #trocado ou qualquer outro, válido. */
const loginSimulado: Login = {
  entrar: () => esperar(ESPERA_SIMULADA_MS),
  async consultarConvite(token) {
    if (!token) return { estado: "invalido" };
    if (token === "expirado" || token === "usado" || token === "trocado") return { estado: token };
    const { representante } = await carregarSituacaoDosDados();
    return { estado: "valido", nome: representante.nome, validoAte: new Date(Date.now() + VALIDADE_SIMULADA_MS).toISOString() };
  },
  criarChaveDoConvite: () => esperar(ESPERA_SIMULADA_MS),
  sair: () => Promise.resolve(),
};

export const login: Login = isDadosReais ? loginDoServidor : loginSimulado;

/** O login provisório do CRM de teste na rede interna (server/src/login/loginProvisorio.ts). */
export function entrarComSenha(senha: string): Promise<void> {
  return postar("/api/entrar/senha", { senha });
}

async function postar<T = void>(caminho: string, corpo?: object): Promise<T> {
  const resposta = await fetch(caminho, {
    method: "POST",
    headers: corpo ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!resposta.ok) throw new Error(await mensagemDeErro(resposta));
  return resposta.status === 204 ? (undefined as T) : ((await resposta.json()) as T);
}

function esperar(milissegundos: number): Promise<void> {
  return new Promise((resolver) => window.setTimeout(resolver, milissegundos));
}
