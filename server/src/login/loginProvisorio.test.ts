import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "../app.ts";
import { abrirBancoDoApp } from "../bancoDoApp.ts";
import { lerConfiguracaoDaRedeInterna } from "../configuracao.ts";
import { criarFotoAtual, type FotoAtual } from "../foto/fotoAtual.ts";
import { gravarFotoDeTeste, type PastasDeTeste } from "../fotoDeTeste.ts";
import { MAXIMO_DE_ERROS, NOME_DO_LOGIN_PROVISORIO } from "./loginProvisorio.ts";
import { listarUsuarios } from "./usuarios.ts";

const ORIGEM = "http://192.168.0.50:4175";
const SENHA = "4321";

let pastas: PastasDeTeste;
let foto: FotoAtual;
let banco: DatabaseSync;
let app: FastifyInstance;

beforeAll(() => {
  pastas = gravarFotoDeTeste();
  foto = criarFotoAtual(pastas);
});

beforeEach(() => {
  banco = abrirBancoDoApp(":memory:");
  app = criarApp({ foto, banco, origem: ORIGEM, loginProvisorio: { senha: SENHA, codigos: ["1401"] } });
});

afterAll(() => {
  foto.fechar();
  fs.rmSync(pastas.raiz, { recursive: true, force: true });
});

function entrarComSenha(senha: string) {
  return app.inject({ method: "POST", url: "/api/entrar/senha", headers: { origin: ORIGEM }, payload: { senha } });
}

describe("login provisório da rede interna", () => {
  it("com a senha certa, abre a sessão dos códigos da configuração, num cookie que vale por http", async () => {
    const resposta = await entrarComSenha(SENHA);

    expect(resposta.statusCode).toBe(204);
    const cookie = String(resposta.headers["set-cookie"]);
    expect(cookie).toMatch(/^crm-rede-interna=/);
    expect(cookie).not.toMatch(/Secure/);
    const situacao = await app.inject({ method: "GET", url: "/api/situacao", headers: { cookie: cookie.split(";")[0] } });
    expect(situacao.statusCode).toBe(200);
    expect(listarUsuarios(banco)).toMatchObject([{ nome: NOME_DO_LOGIN_PROVISORIO, codigos: ["1401"] }]);
  });

  it("recusa a senha errada sem abrir sessão", async () => {
    const resposta = await entrarComSenha("1234");

    expect(resposta.statusCode).toBe(401);
    expect(resposta.headers["set-cookie"]).toBeUndefined();
  });

  it("trava depois de muitas senhas erradas, até para a senha certa", async () => {
    for (let i = 0; i < MAXIMO_DE_ERROS; i++) await entrarComSenha(`errada-${i}`);

    expect((await entrarComSenha(SENHA)).statusCode).toBe(429);
  });

  it("usa o mesmo login nas entradas seguintes e acerta os códigos quando a configuração muda", async () => {
    await entrarComSenha(SENHA);
    app = criarApp({ foto, banco, origem: ORIGEM, loginProvisorio: { senha: SENHA, codigos: ["1401", "9999"] } });

    expect((await entrarComSenha(SENHA)).statusCode).toBe(204);
    expect(listarUsuarios(banco)).toMatchObject([{ nome: NOME_DO_LOGIN_PROVISORIO, codigos: ["1401", "9999"] }]);
  });

  it("não existe no CRM de sempre", async () => {
    const crm = criarApp({ foto, banco, origem: "http://localhost:5175" });

    const resposta = await crm.inject({ method: "POST", url: "/api/entrar/senha", headers: { origin: "http://localhost:5175" }, payload: { senha: SENHA } });
    expect(resposta.statusCode).toBe(404);
  });
});

describe("lerConfiguracaoDaRedeInterna", () => {
  let pasta: string;
  let arquivo: string;

  beforeEach(() => {
    pasta = fs.mkdtempSync(path.join(os.tmpdir(), "crm-rede-interna-"));
    arquivo = path.join(pasta, "rede-interna.env");
    fs.writeFileSync(arquivo, "CRM_SENHA_PROVISORIA=4321\nCRM_LOGIN_PROVISORIO_CODIGOS=1401,1402\n");
  });

  it("lê a senha e os códigos e usa um app.db só da rede interna", () => {
    const configuracao = lerConfiguracaoDaRedeInterna({ CRM_ORIGEM_DA_REDE_INTERNA: ORIGEM }, arquivo);

    expect(configuracao.loginProvisorio).toEqual({ senha: "4321", codigos: ["1401", "1402"] });
    expect(configuracao.origem).toBe(ORIGEM);
    expect(path.basename(configuracao.arquivoDoApp)).toBe("app-rede-interna.db");
  });

  it("recusa a produção", () => {
    expect(() => lerConfiguracaoDaRedeInterna({ NODE_ENV: "production", CRM_ORIGEM_DA_REDE_INTERNA: ORIGEM }, arquivo)).toThrow(/produção/);
  });

  it("recusa endereço fora da rede interna ou com https", () => {
    for (const origem of ["http://200.10.20.30:4175", "https://192.168.0.50:4175", "http://crm.exemplo.com.br", undefined]) {
      expect(() => lerConfiguracaoDaRedeInterna({ CRM_ORIGEM_DA_REDE_INTERNA: origem }, arquivo)).toThrow(/CRM_ORIGEM_DA_REDE_INTERNA/);
    }
  });

  it("recusa a configuração sem senha ou com códigos fora do formato", () => {
    fs.writeFileSync(arquivo, "CRM_SENHA_PROVISORIA=\nCRM_LOGIN_PROVISORIO_CODIGOS=1401\n");
    expect(() => lerConfiguracaoDaRedeInterna({ CRM_ORIGEM_DA_REDE_INTERNA: ORIGEM }, arquivo)).toThrow(/CRM_SENHA_PROVISORIA/);
    fs.writeFileSync(arquivo, "CRM_SENHA_PROVISORIA=4321\nCRM_LOGIN_PROVISORIO_CODIGOS=1401; 1402\n");
    expect(() => lerConfiguracaoDaRedeInterna({ CRM_ORIGEM_DA_REDE_INTERNA: ORIGEM }, arquivo)).toThrow(/CRM_LOGIN_PROVISORIO_CODIGOS/);
  });
});
