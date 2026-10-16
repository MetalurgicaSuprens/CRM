import fs from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "../app.ts";
import { abrirBancoDoApp } from "../bancoDoApp.ts";
import { criarFotoAtual, type FotoAtual } from "../foto/fotoAtual.ts";
import { CLIENTE_DE_A, gravarFotoDeTeste } from "../fotoDeTeste.ts";
import { criarAutenticadorDeTeste, type AutenticadorDeTeste } from "./autenticadorDeTeste.ts";
import { resumoDasChavesDo, revogarChavesDo } from "./chaves.ts";
import { criarConvite } from "./convites.ts";
import { criarUsuario, desativarUsuario, type Usuario } from "./usuarios.ts";

const ORIGEM = "http://localhost:5175";
const UM_MINUTO = 60_000;

let pasta: string;
let foto: FotoAtual;
let banco: DatabaseSync;
let app: FastifyInstance;
/** O relógio do servidor nos testes: anda só quando o teste manda. */
let agora: Date;
let star: Usuario;

beforeAll(() => {
  pasta = gravarFotoDeTeste();
  foto = criarFotoAtual(pasta);
});

beforeEach(() => {
  banco = abrirBancoDoApp(":memory:");
  agora = new Date("2026-10-15T12:00:00.000Z");
  app = criarApp({ foto, banco, origem: ORIGEM, agora: () => agora });
  star = criarUsuario(banco, { nome: "Star Vendas", codigos: ["1401"], autorizados: new Set(["1401"]), ligadoPor: "teste" }, agora);
});

afterAll(() => {
  foto.fechar();
  fs.rmSync(pasta, { recursive: true, force: true });
});

function passar(milissegundos: number): void {
  agora = new Date(agora.getTime() + milissegundos);
}

function postar(url: string, corpo?: object, extras: { cookie?: string; origem?: string } = {}) {
  const headers: Record<string, string> = { origin: extras.origem ?? ORIGEM };
  if (extras.cookie) headers.cookie = extras.cookie;
  return app.inject({ method: "POST", url, headers, ...(corpo ? { payload: corpo } : {}) });
}

function ler(url: string, cookie: string) {
  return app.inject({ method: "GET", url, headers: { cookie } });
}

function convidar(): string {
  return criarConvite(banco, { usuario: star.id, criadoPor: "teste" }, agora).token;
}

async function criarChave(token: string, aparelho: AutenticadorDeTeste, origemDoAparelho = ORIGEM) {
  const opcoes = (await postar("/api/convite/opcoes", { token })).json();
  return postar("/api/convite/chave", { token, resposta: aparelho.criar(opcoes, origemDoAparelho) });
}

async function entrar(aparelho: AutenticadorDeTeste) {
  const opcoes = (await postar("/api/entrar/opcoes", {})).json();
  return postar("/api/entrar", { resposta: aparelho.usar(opcoes, ORIGEM) });
}

/** "nome=valor" do Set-Cookie, para mandar de volta. */
function cookieDa(resposta: LightMyRequestResponse): string {
  return String(resposta.headers["set-cookie"]).split(";")[0] ?? "";
}

async function aparelhoComChave(): Promise<AutenticadorDeTeste> {
  const aparelho = criarAutenticadorDeTeste();
  expect((await criarChave(convidar(), aparelho)).statusCode).toBe(204);
  return aparelho;
}

describe("convite", () => {
  it("mostra o nome e a validade do convite válido, sem abrir sessão", async () => {
    const resposta = await postar("/api/convite/consultar", { token: convidar() });
    expect(resposta.json()).toEqual({ estado: "valido", nome: "Star Vendas", validoAte: "2026-10-17T12:00:00.000Z" });
    expect(resposta.headers["set-cookie"]).toBeUndefined();
  });

  it("diz que o convite expirou depois de 48 horas e que foi trocado quando sai um mais novo", async () => {
    const primeiro = convidar();
    passar(48 * 60 * UM_MINUTO);
    expect((await postar("/api/convite/consultar", { token: primeiro })).json()).toEqual({ estado: "expirado" });
    convidar();
    expect((await postar("/api/convite/consultar", { token: primeiro })).json()).toEqual({ estado: "trocado" });
  });

  it("não reconhece o token que não existe, nem o fora do formato", async () => {
    expect((await postar("/api/convite/consultar", { token: "A".repeat(43) })).json()).toEqual({ estado: "invalido" });
    expect((await postar("/api/convite/consultar", { token: "curto" })).statusCode).toBe(400);
  });

  it("cria a chave, já abre a sessão e dá os dados dos códigos do login", async () => {
    const aparelho = criarAutenticadorDeTeste();
    const resposta = await criarChave(convidar(), aparelho);
    expect(resposta.statusCode).toBe(204);
    const clientes = await ler("/api/clientes", cookieDa(resposta));
    expect(clientes.statusCode).toBe(200);
    expect(clientes.json().map((cliente: { codigo: string }) => cliente.codigo)).toContain(CLIENTE_DE_A);
    expect(resumoDasChavesDo(banco, star.id)).toMatchObject([{ id: aparelho.idDaCredencial, provedor: "Google", sincronizada: true, revogadaEm: null }]);
  });

  it("grava o cookie da sessão só com HttpOnly, Secure, SameSite=Strict e o prefixo __Host-", async () => {
    const cookie = String((await criarChave(convidar(), criarAutenticadorDeTeste())).headers["set-cookie"]);
    expect(cookie).toMatch(/^__Host-crm=[A-Za-z0-9_-]{43};/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Domain");
  });

  it("não deixa o mesmo convite criar uma segunda chave, nem com dois pedidos ao mesmo tempo", async () => {
    const token = convidar();
    const [primeiras, segundas] = await Promise.all([postar("/api/convite/opcoes", { token }), postar("/api/convite/opcoes", { token })]);
    const primeira = postar("/api/convite/chave", { token, resposta: criarAutenticadorDeTeste().criar(primeiras.json(), ORIGEM) });
    const segunda = postar("/api/convite/chave", { token, resposta: criarAutenticadorDeTeste().criar(segundas.json(), ORIGEM) });
    expect((await Promise.all([primeira, segunda])).map((resposta) => resposta.statusCode).sort()).toEqual([204, 410]);
    expect((await postar("/api/convite/opcoes", { token })).statusCode).toBe(410);
    expect((await postar("/api/convite/consultar", { token })).json()).toEqual({ estado: "usado" });
  });

  it("recusa a chave criada numa página de outra origem, e o convite continua valendo", async () => {
    const token = convidar();
    expect((await criarChave(token, criarAutenticadorDeTeste(), "https://crm-suprens.example")).statusCode).toBe(400);
    expect((await postar("/api/convite/consultar", { token })).json()).toMatchObject({ estado: "valido" });
  });

  it("recusa a resposta com o desafio de outro convite", async () => {
    const outro = criarUsuario(banco, { nome: "Outra", codigos: ["9999"], autorizados: new Set(["9999"]), ligadoPor: "teste" }, agora);
    const conviteDoOutro = criarConvite(banco, { usuario: outro.id, criadoPor: "teste" }, agora).token;
    const opcoesDoOutro = (await postar("/api/convite/opcoes", { token: conviteDoOutro })).json();
    const token = convidar();
    const resposta = await postar("/api/convite/chave", { token, resposta: criarAutenticadorDeTeste().criar(opcoesDoOutro, ORIGEM) });
    expect(resposta.statusCode).toBe(400);
  });

  it("recusa a credencial que já está gravada, em vez de trocar a chave de alguém", async () => {
    const aparelho = await aparelhoComChave();
    const token = convidar();
    expect((await criarChave(token, aparelho)).statusCode).toBe(400);
    expect((await postar("/api/convite/consultar", { token })).json()).toMatchObject({ estado: "valido" });
  });

  it("não mostra o convite de um login desativado", async () => {
    const token = convidar();
    desativarUsuario(banco, star.id);
    expect((await postar("/api/convite/consultar", { token })).json()).toEqual({ estado: "invalido" });
  });
});

describe("entrada", () => {
  it("entra com a chave criada pelo convite e abre uma sessão nova", async () => {
    const aparelho = await aparelhoComChave();
    const resposta = await entrar(aparelho);
    expect(resposta.statusCode).toBe(204);
    const situacao = (await ler("/api/situacao", cookieDa(resposta))).json();
    expect(situacao.representante).toEqual({ nome: "Star Vendas", codigos: ["1401"] });
  });

  it("recusa a chave que o CRM não conhece", async () => {
    expect((await entrar(criarAutenticadorDeTeste())).statusCode).toBe(401);
  });

  it("recusa outro aparelho que se passa pela chave: a assinatura não confere", async () => {
    const aparelho = await aparelhoComChave();
    const impostor = criarAutenticadorDeTeste();
    const opcoes = (await postar("/api/entrar/opcoes", {})).json();
    const falsa = impostor.usar(opcoes, ORIGEM);
    const resposta = await postar("/api/entrar", { resposta: { ...falsa, id: aparelho.idDaCredencial, rawId: aparelho.idDaCredencial } });
    expect(resposta.statusCode).toBe(401);
  });

  it("não aceita a mesma resposta duas vezes: o desafio vale uma vez só", async () => {
    const aparelho = await aparelhoComChave();
    const opcoes = (await postar("/api/entrar/opcoes", {})).json();
    const resposta = aparelho.usar(opcoes, ORIGEM);
    expect((await postar("/api/entrar", { resposta })).statusCode).toBe(204);
    expect((await postar("/api/entrar", { resposta })).statusCode).toBe(401);
  });

  it("recusa a chave revogada e encerra as sessões abertas por ela", async () => {
    const aparelho = await aparelhoComChave();
    const cookie = cookieDa(await entrar(aparelho));
    revogarChavesDo(banco, star.id, agora);
    expect((await entrar(aparelho)).statusCode).toBe(403);
    expect((await ler("/api/clientes", cookie)).json()).toMatchObject({ motivo: "revogada" });
  });
});

describe("sessão", () => {
  it("termina depois de 60 minutos sem uso, com o motivo, e apaga o cookie", async () => {
    const cookie = cookieDa(await entrar(await aparelhoComChave()));
    passar(59 * UM_MINUTO);
    expect((await ler("/api/clientes", cookie)).statusCode).toBe(200);
    passar(59 * UM_MINUTO);
    expect((await ler("/api/clientes", cookie)).statusCode).toBe(200);
    passar(60 * UM_MINUTO);
    const vencida = await ler("/api/clientes", cookie);
    expect(vencida.statusCode).toBe(401);
    expect(vencida.json()).toMatchObject({ motivo: "inatividade" });
    expect(String(vencida.headers["set-cookie"])).toMatch(/^__Host-crm=; Max-Age=0/);
  });

  it("termina 12 horas depois de aberta, mesmo em uso", async () => {
    const cookie = cookieDa(await entrar(await aparelhoComChave()));
    for (let vez = 0; vez < 12; vez += 1) {
      passar(59 * UM_MINUTO);
      expect((await ler("/api/clientes", cookie)).statusCode).toBe(200);
    }
    // 12 vezes 59 minutos são 11h48; mais 13 minutos passam das 12 horas, sem ficar 60 minutos parada.
    passar(13 * UM_MINUTO);
    expect((await ler("/api/clientes", cookie)).json()).toMatchObject({ motivo: "limite" });
  });

  it("termina quando o login é desativado", async () => {
    const cookie = cookieDa(await entrar(await aparelhoComChave()));
    desativarUsuario(banco, star.id);
    expect((await ler("/api/clientes", cookie)).json()).toMatchObject({ motivo: "revogada" });
  });

  it("sair encerra a sessão, apaga o cookie e manda o navegador limpar o que guardou", async () => {
    const cookie = cookieDa(await entrar(await aparelhoComChave()));
    const saida = await postar("/api/sair", undefined, { cookie });
    expect(saida.statusCode).toBe(204);
    expect(String(saida.headers["set-cookie"])).toMatch(/^__Host-crm=; Max-Age=0/);
    expect(saida.headers["clear-site-data"]).toBe('"cache", "cookies", "storage"');
    expect((await ler("/api/clientes", cookie)).json()).toMatchObject({ motivo: "saiu" });
  });

  it("registra na auditoria a criação da chave, a entrada e a saída, sem nome de ninguém", async () => {
    const cookie = cookieDa(await entrar(await aparelhoComChave()));
    await postar("/api/sair", undefined, { cookie });
    const eventos = banco.prepare("SELECT usuario, evento, alvo, resultado FROM auditoria ORDER BY id").all();
    expect(eventos.map((evento) => evento.evento)).toEqual(["chave_criada", "entrada", "entrada", "saida"]);
    expect(eventos.every((evento) => evento.usuario === star.id && evento.resultado === "ok")).toBe(true);
    expect(JSON.stringify(eventos)).not.toContain("Star Vendas");
  });
});

describe("proteções", () => {
  it("recusa o POST que vem de outro site, mesmo com a sessão", async () => {
    const cookie = cookieDa(await entrar(await aparelhoComChave()));
    expect((await postar("/api/sair", undefined, { cookie, origem: "https://outro-site.example" })).statusCode).toBe(403);
    const semOrigem = await app.inject({ method: "POST", url: "/api/entrar/opcoes", headers: { "sec-fetch-site": "cross-site" } });
    expect(semOrigem.statusCode).toBe(403);
    const mesmoSite = await app.inject({ method: "POST", url: "/api/entrar/opcoes", headers: { "sec-fetch-site": "same-origin" } });
    expect(mesmoSite.statusCode).toBe(200);
  });

  it("limita as tentativas de login por IP, sem acreditar no X-Forwarded-For que o cliente inventa", async () => {
    const tentar = (remoto: string, encaminhado: string) =>
      app.inject({ method: "POST", url: "/api/entrar/opcoes", remoteAddress: remoto, headers: { origin: ORIGEM, "x-forwarded-for": encaminhado } });
    for (let tentativa = 0; tentativa < 30; tentativa += 1) expect((await tentar("203.0.113.9", `198.51.100.${tentativa}`)).statusCode).toBe(200);
    expect((await tentar("203.0.113.9", "198.51.100.200")).statusCode).toBe(429);
    // Pelo Apache (nesta máquina), o X-Forwarded-For é o IP de quem chamou: outro IP, outra conta.
    expect((await tentar("127.0.0.1", "198.51.100.7")).statusCode).toBe(200);
  });

  it("recusa o corpo fora do formato", async () => {
    expect((await postar("/api/entrar", { resposta: { id: "x" } })).statusCode).toBe(400);
    expect((await postar("/api/convite/chave", { token: "A".repeat(43), resposta: "texto" })).statusCode).toBe(400);
  });
});
