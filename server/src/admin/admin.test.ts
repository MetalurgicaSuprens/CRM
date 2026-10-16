import fs from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DetalheDoLogin, LoginNaGestao, PaginaDoRegistro } from "../../../web/src/admin/tipos.ts";
import { criarApp } from "../app.ts";
import { abrirBancoDoApp } from "../bancoDoApp.ts";
import { criarFotoAtual, type FotoAtual } from "../foto/fotoAtual.ts";
import { CLIENTE_DE_A, gravarFotoDeTeste } from "../fotoDeTeste.ts";
import { criarAutenticadorDeTeste, type AutenticadorDeTeste } from "../login/autenticadorDeTeste.ts";
import { cabecalhoDoCookie, entrarComo, entrarComoAdmin } from "../login/loginDeTeste.ts";
import { PORTAL_DO_ADMIN, PORTAL_DO_CRM } from "../login/portal.ts";
import { criarAppDoAdmin } from "./appDoAdmin.ts";
import { criarLoginDeAdmin } from "./gestao.ts";

const ORIGEM_DO_CRM = "http://localhost:5175";
const ORIGEM_DO_ADMIN = "http://localhost:5179";

let pasta: string;
let foto: FotoAtual;
let banco: DatabaseSync;
let crm: FastifyInstance;
let admin: FastifyInstance;
let cookieDoAdmin: string;
let idDoAdmin: string;

beforeAll(() => {
  pasta = gravarFotoDeTeste();
  foto = criarFotoAtual(pasta);
});

beforeEach(() => {
  banco = abrirBancoDoApp(":memory:");
  crm = criarApp({ foto, banco, origem: ORIGEM_DO_CRM });
  admin = criarAppDoAdmin({ foto, banco, origem: ORIGEM_DO_ADMIN, origemDoCrm: ORIGEM_DO_CRM });
  const entrada = entrarComoAdmin(banco);
  cookieDoAdmin = entrada.cookie;
  idDoAdmin = entrada.admin.id;
});

afterAll(() => {
  foto.fechar();
  fs.rmSync(pasta, { recursive: true, force: true });
});

function lerNoAdmin(url: string, cookie = cookieDoAdmin) {
  return admin.inject({ method: "GET", url, headers: { cookie } });
}

function postarNoAdmin(url: string, corpo?: object, cookie = cookieDoAdmin) {
  return admin.inject({ method: "POST", url, headers: { cookie, origin: ORIGEM_DO_ADMIN }, ...(corpo ? { payload: corpo } : {}) });
}

function postar(app: FastifyInstance, origem: string, url: string, corpo: object) {
  return app.inject({ method: "POST", url, headers: { origin: origem }, payload: corpo });
}

async function criarStar(codigos = ["1401"]): Promise<{ id: string; token: string }> {
  const resposta = await postarNoAdmin("/api/admin/logins", { nome: "Star Vendas", codigos });
  expect(resposta.statusCode).toBe(201);
  const { idDoLogin, link } = resposta.json();
  return { id: idDoLogin, token: String(link).split("#")[1] ?? "" };
}

async function criarChaveNoCrm(token: string, aparelho: AutenticadorDeTeste): Promise<LightMyRequestResponse> {
  const opcoes = (await postar(crm, ORIGEM_DO_CRM, "/api/convite/opcoes", { token })).json();
  return postar(crm, ORIGEM_DO_CRM, "/api/convite/chave", { token, resposta: aparelho.criar(opcoes, ORIGEM_DO_CRM) });
}

function cookieDa(resposta: LightMyRequestResponse): string {
  return String(resposta.headers["set-cookie"]).split(";")[0] ?? "";
}

async function loginNaLista(id: string): Promise<LoginNaGestao | undefined> {
  return ((await lerNoAdmin("/api/admin/logins")).json() as LoginNaGestao[]).find((login) => login.id === id);
}

describe("os dois portais não se misturam", () => {
  it("as rotas de admin pedem a sessão do admin, e a do representante não vale nelas", async () => {
    const cookieDoRepresentante = entrarComo(banco, ["1401"]);
    const rotas = admin.rotasRegistradas.filter((rota) => rota.acesso === "admin");
    expect(rotas.length).toBeGreaterThan(5);
    for (const { metodo, url } of rotas) {
      const caminho = url.replace(":id", "0123456789abcdef");
      for (const cookie of ["", cookieDoRepresentante]) {
        const resposta = await admin.inject({ method: metodo, url: caminho, headers: { cookie, origin: ORIGEM_DO_ADMIN } });
        expect(resposta.statusCode, `${metodo} ${url}`).toBe(401);
      }
    }
  });

  it("o token da sessão de um portal não abre o outro, nem com o nome do cookie trocado", async () => {
    const tokenDoAdmin = cookieDoAdmin.split("=")[1] ?? "";
    expect((await crm.inject({ method: "GET", url: "/api/clientes", headers: { cookie: cabecalhoDoCookie(PORTAL_DO_CRM, tokenDoAdmin) } })).statusCode).toBe(401);
    const tokenDoRepresentante = entrarComo(banco, ["1401"]).split("=")[1] ?? "";
    const comoAdmin = await lerNoAdmin("/api/admin/logins", cabecalhoDoCookie(PORTAL_DO_ADMIN, tokenDoRepresentante));
    expect(comoAdmin.statusCode).toBe(401);
  });

  it("a API do CRM não tem as rotas de admin, e a da administração não tem os dados do CRM", async () => {
    expect((await crm.inject({ method: "GET", url: "/api/admin/logins", headers: { cookie: cookieDoAdmin } })).statusCode).toBe(404);
    expect((await lerNoAdmin("/api/clientes")).statusCode).toBe(404);
  });

  it("o convite e a chave de admin só valem na administração, e os do representante só no CRM", async () => {
    const conviteDoAdmin = criarLoginDeAdmin({ banco, agora: new Date(), foto: () => foto.abrir(), origens: { crm: ORIGEM_DO_CRM, admin: ORIGEM_DO_ADMIN } }, { nome: "Lucas" }, "teste");
    const token = conviteDoAdmin.link.split("#")[1] ?? "";
    expect(conviteDoAdmin.link.startsWith(`${ORIGEM_DO_ADMIN}/convite#`)).toBe(true);
    expect((await postar(crm, ORIGEM_DO_CRM, "/api/convite/consultar", { token })).json()).toEqual({ estado: "invalido" });
    const aparelho = criarAutenticadorDeTeste();
    const opcoes = (await postar(admin, ORIGEM_DO_ADMIN, "/api/convite/opcoes", { token })).json();
    expect((await postar(admin, ORIGEM_DO_ADMIN, "/api/convite/chave", { token, resposta: aparelho.criar(opcoes, ORIGEM_DO_ADMIN) })).statusCode).toBe(204);
    const opcoesDoCrm = (await postar(crm, ORIGEM_DO_CRM, "/api/entrar/opcoes", {})).json();
    expect((await postar(crm, ORIGEM_DO_CRM, "/api/entrar", { resposta: aparelho.usar(opcoesDoCrm, ORIGEM_DO_CRM) })).statusCode).toBe(401);

    const { token: conviteDaStar } = await criarStar();
    expect((await postar(admin, ORIGEM_DO_ADMIN, "/api/convite/consultar", { token: conviteDaStar })).json()).toEqual({ estado: "invalido" });
  });
});

describe("logins", () => {
  it("cria o login com o convite do CRM, e ele aguarda o primeiro acesso", async () => {
    const { id } = await criarStar(["1401", "9999"]);
    const login = await loginNaLista(id);
    expect(login).toMatchObject({
      nome: "Star Vendas",
      papel: "representante",
      situacao: "aguardando",
      codigos: [
        { codigo: "1401", nome: "STAR VENDAS" },
        { codigo: "9999", nome: "OUTRA REPRESENTACAO" },
      ],
      chavesAtivas: 0,
      ultimoConvite: { estado: "valendo" },
    });
  });

  it("recusa código fora da lista de autorizados e código de outro login ativo, com o motivo", async () => {
    const fora = await postarNoAdmin("/api/admin/logins", { nome: "Outra", codigos: ["5555"] });
    expect(fora.statusCode).toBe(409);
    expect(fora.json().erro).toMatch(/fora da lista de autorizados da foto: 5555/);
    await criarStar();
    expect((await postarNoAdmin("/api/admin/logins", { nome: "Outra", codigos: ["1401"] })).json().erro).toMatch(/já ligado a outro login ativo/);
    expect((await postarNoAdmin("/api/admin/logins", { nome: "", codigos: ["1401"] })).statusCode).toBe(400);
  });

  it("depois da chave criada, o login fica ativo, com o provedor da chave e a sessão aberta", async () => {
    const { id, token } = await criarStar();
    expect((await criarChaveNoCrm(token, criarAutenticadorDeTeste())).statusCode).toBe(204);
    expect(await loginNaLista(id)).toMatchObject({ situacao: "ativo", chavesAtivas: 1, provedores: ["Google"], sessoesAbertas: 1, ultimoConvite: { estado: "usado" } });
    const detalhe: DetalheDoLogin = (await lerNoAdmin(`/api/admin/logins/${id}`)).json();
    expect(detalhe.chaves).toMatchObject([{ provedor: "Google", sincronizada: true, bloqueadaEm: null }]);
    expect(detalhe.sessoes).toMatchObject([{ aberta: true, provedor: "Google" }]);
  });

  it("o convite novo troca o anterior, e o link novo leva ao CRM", async () => {
    const { id, token } = await criarStar();
    const novo = (await postarNoAdmin(`/api/admin/logins/${id}/convite`)).json();
    expect(novo.link.startsWith(`${ORIGEM_DO_CRM}/convite#`)).toBe(true);
    expect((await postar(crm, ORIGEM_DO_CRM, "/api/convite/consultar", { token })).json()).toEqual({ estado: "trocado" });
  });

  it("troca os códigos do login, e a sessão aberta do representante já vê os novos", async () => {
    const { id, token } = await criarStar();
    const cookie = cookieDa(await criarChaveNoCrm(token, criarAutenticadorDeTeste()));
    expect((await postarNoAdmin(`/api/admin/logins/${id}/codigos`, { codigos: ["1401", "9999"] })).json()).toEqual({ codigos: ["1401", "9999"] });
    const situacao = (await crm.inject({ method: "GET", url: "/api/situacao", headers: { cookie } })).json();
    expect(situacao.representante.codigos).toEqual(["1401", "9999"]);
  });

  it("bloquear as chaves derruba a sessão do representante, e o login fica sem acesso até um convite novo", async () => {
    const { id, token } = await criarStar();
    const cookie = cookieDa(await criarChaveNoCrm(token, criarAutenticadorDeTeste()));
    expect((await postarNoAdmin(`/api/admin/logins/${id}/bloquear-chaves`)).json()).toEqual({ bloqueadas: 1 });
    expect((await crm.inject({ method: "GET", url: "/api/clientes", headers: { cookie } })).json()).toMatchObject({ motivo: "revogada" });
    expect(await loginNaLista(id)).toMatchObject({ situacao: "sem_acesso", chavesAtivas: 0, sessoesAbertas: 0 });
  });

  it("bloqueia uma chave só: a do aparelho perdido para de entrar, e a outra continua", async () => {
    const { id, token } = await criarStar();
    const perdido = criarAutenticadorDeTeste();
    const cookieDoPerdido = cookieDa(await criarChaveNoCrm(token, perdido));
    const novo = (await postarNoAdmin(`/api/admin/logins/${id}/convite`)).json();
    const cookieDoNovo = cookieDa(await criarChaveNoCrm(String(novo.link).split("#")[1] ?? "", criarAutenticadorDeTeste()));
    expect((await postarNoAdmin(`/api/admin/chaves/${perdido.idDaCredencial}/bloquear`)).statusCode).toBe(204);
    expect((await crm.inject({ method: "GET", url: "/api/clientes", headers: { cookie: cookieDoPerdido } })).statusCode).toBe(401);
    expect((await crm.inject({ method: "GET", url: "/api/clientes", headers: { cookie: cookieDoNovo } })).statusCode).toBe(200);
    expect(await loginNaLista(id)).toMatchObject({ situacao: "ativo", chavesAtivas: 1 });
  });

  it("encerra as sessões com o motivo próprio: a chave continua valendo", async () => {
    const { id, token } = await criarStar();
    const cookie = cookieDa(await criarChaveNoCrm(token, criarAutenticadorDeTeste()));
    expect((await postarNoAdmin(`/api/admin/logins/${id}/encerrar-sessoes`)).json()).toEqual({ encerradas: 1 });
    expect((await crm.inject({ method: "GET", url: "/api/clientes", headers: { cookie } })).json()).toMatchObject({ motivo: "encerrada" });
    expect(await loginNaLista(id)).toMatchObject({ situacao: "ativo", sessoesAbertas: 0 });
  });

  it("desativa o login uma vez, e a segunda tentativa explica que já está desativado", async () => {
    const { id } = await criarStar();
    expect((await postarNoAdmin(`/api/admin/logins/${id}/desativar`)).statusCode).toBe(204);
    expect(await loginNaLista(id)).toMatchObject({ situacao: "desativado" });
    expect((await postarNoAdmin(`/api/admin/logins/${id}/desativar`)).json().erro).toMatch(/já está desativado/);
  });

  it("o admin não tranca a si mesmo para fora", async () => {
    for (const acao of ["desativar", "bloquear-chaves", "encerrar-sessoes"]) {
      const resposta = await postarNoAdmin(`/api/admin/logins/${idDoAdmin}/${acao}`);
      expect(resposta.statusCode, acao).toBe(409);
    }
    expect((await lerNoAdmin("/api/admin/logins")).statusCode).toBe(200);
  });

  it("responde 404 ao login que não existe e recusa o POST de outra origem", async () => {
    expect((await lerNoAdmin("/api/admin/logins/0123456789abcdef")).statusCode).toBe(404);
    expect((await postarNoAdmin("/api/admin/logins/0123456789abcdef/convite")).statusCode).toBe(404);
    const deFora = await admin.inject({ method: "POST", url: "/api/admin/logins", headers: { cookie: cookieDoAdmin, origin: ORIGEM_DO_CRM }, payload: { nome: "X", codigos: ["1401"] } });
    expect(deFora.statusCode).toBe(403);
  });
});

describe("representantes, situação e registro", () => {
  it("lista os códigos da foto com o login ativo que já usa cada um", async () => {
    const { id } = await criarStar();
    expect((await lerNoAdmin("/api/admin/representantes")).json()).toEqual([
      { codigo: "1401", nome: "STAR VENDAS", login: { id, nome: "Star Vendas" } },
      { codigo: "9999", nome: "OUTRA REPRESENTACAO", login: null },
    ]);
  });

  it("mostra quem está na administração e a foto do ERP", async () => {
    expect((await lerNoAdmin("/api/admin/situacao")).json()).toMatchObject({
      admin: { id: idDoAdmin, nome: "Admin de teste" },
      foto: { dataRef: "2026-10-13", representantes: 2, clientes: 3 },
    });
  });

  it("registra as ações com quem fez e o alvo pelo nome, do mais novo ao mais velho", async () => {
    const { id, token } = await criarStar();
    const cookie = cookieDa(await criarChaveNoCrm(token, criarAutenticadorDeTeste()));
    await crm.inject({ method: "GET", url: `/api/clientes/${CLIENTE_DE_A}`, headers: { cookie } });
    const { eventos }: PaginaDoRegistro = (await lerNoAdmin(`/api/admin/registro?login=${id}`)).json();
    expect(eventos.map(({ evento, quem, alvo }) => [evento, quem, alvo])).toEqual([
      ["ficha_consultada", "Star Vendas", "CLIENTE DE A"],
      ["entrada", "Star Vendas", "Google de Star Vendas"],
      ["chave_criada", "Star Vendas", "Google de Star Vendas"],
      ["convite_criado", "Admin de teste", "Star Vendas"],
      ["usuario_criado", "Admin de teste", "Star Vendas"],
    ]);
  });

  it("pagina o registro de 100 em 100", async () => {
    const { id } = await criarStar();
    // A criação do login e do primeiro convite, e mais 110 convites: 112 eventos.
    for (let vez = 0; vez < 110; vez += 1) await postarNoAdmin(`/api/admin/logins/${id}/convite`);
    const primeira: PaginaDoRegistro = (await lerNoAdmin("/api/admin/registro")).json();
    expect(primeira.eventos).toHaveLength(100);
    expect(primeira.temMais).toBe(true);
    const ultimo = primeira.eventos.at(-1)?.id ?? 0;
    const segunda: PaginaDoRegistro = (await lerNoAdmin(`/api/admin/registro?antes=${ultimo}`)).json();
    expect(segunda.eventos.every((evento) => evento.id < ultimo)).toBe(true);
    expect(segunda.temMais).toBe(false);
  });
});
