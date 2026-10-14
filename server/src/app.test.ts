import fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp } from "./app.ts";
import { criarFotoAtual, type FotoAtual } from "./foto/fotoAtual.ts";
import { CLIENTE_DE_A, CLIENTE_DE_B, CLIENTE_NEGATIVO_DE_A, MARCAS_DE_B, gravarFotoDeTeste } from "./fotoDeTeste.ts";
import { sessaoDeTeste, type FonteDeSessao } from "./sessao.ts";

const LOGIN_DE_A = sessaoDeTeste("Teste A", ["1401"]);
const SEM_LOGIN: FonteDeSessao = () => null;

let pasta: string;
let foto: FotoAtual;

beforeAll(() => {
  pasta = gravarFotoDeTeste();
  foto = criarFotoAtual(pasta);
});

afterAll(() => {
  foto.fechar();
  fs.rmSync(pasta, { recursive: true, force: true });
});

describe("acesso declarado", () => {
  it("não sobe com uma rota que não declara config.acesso", async () => {
    const app = criarApp({ foto, sessaoDe: LOGIN_DE_A });
    await expect(async () => {
      app.get("/api/sem-acesso", () => "nada");
      await app.ready();
    }).rejects.toThrow(/config.acesso/);
  });

  it("responde 401 às rotas de representante sem sessão", async () => {
    const app = criarApp({ foto, sessaoDe: SEM_LOGIN });
    for (const { metodo, url } of app.rotasRegistradas.filter((rota) => rota.metodo === "GET")) {
      const resposta = await app.inject({ method: metodo, url: url.replace(":codigo", CLIENTE_DE_A) });
      expect(resposta.statusCode, url).toBe(401);
    }
  });

  it("não dá a sessão de teste a quem chega com outro endereço, como pelo Apache", async () => {
    const app = criarApp({ foto, sessaoDe: LOGIN_DE_A });
    const resposta = await app.inject({ method: "GET", url: "/api/clientes", headers: { host: "crm.suprens.com.br" } });
    expect(resposta.statusCode).toBe(401);
  });
});

describe("escopo: o login A nunca vê os dados de B", () => {
  it("percorre todas as rotas: ficha de B dá 404 e nenhuma lista traz B", async () => {
    const app = criarApp({ foto, sessaoDe: LOGIN_DE_A });
    await app.ready();
    const rotas = app.rotasRegistradas.filter((rota) => rota.metodo === "GET");
    expect(rotas.length).toBeGreaterThan(0);
    for (const { url } of rotas) {
      const resposta = await app.inject({ method: "GET", url: url.replace(":codigo", CLIENTE_DE_B) });
      if (url.includes(":codigo")) {
        expect(resposta.statusCode, url).toBe(404);
        continue;
      }
      expect(resposta.statusCode, url).toBe(200);
      for (const marca of MARCAS_DE_B) expect(resposta.body, `${url} mostrou ${marca}`).not.toContain(marca);
    }
  });

  it("mostra a A a própria carteira e a ficha do cliente dele", async () => {
    const app = criarApp({ foto, sessaoDe: LOGIN_DE_A });
    const clientes = await app.inject({ method: "GET", url: "/api/clientes" });
    expect(clientes.json()).toHaveLength(2);
    const ficha = await app.inject({ method: "GET", url: `/api/clientes/${CLIENTE_DE_A}` });
    expect(ficha.statusCode).toBe(200);
    expect(ficha.json()).toMatchObject({ nome: "CLIENTE DE A", codigoErp: "123456780001", pedidosEmAberto: [{ numero: "100001" }] });
  });

  it("conta no Início o pedido do A para cliente de outra carteira, sem listá-lo", async () => {
    const app = criarApp({ foto, sessaoDe: LOGIN_DE_A });
    const painel = await app.inject({ method: "GET", url: "/api/painel" });
    expect(painel.json().pedidosEmAberto).toEqual({ quantidade: 2, valor: 8_000 });
    // Faturado de outubro (1.000) mais o ritmo de A (1.000 por dia útil) nos 13 dias úteis que faltam.
    expect(painel.json().mesAtual.projecao).toEqual({ valor: 14_000, base: "ritmo" });
    const pedidos = await app.inject({ method: "GET", url: "/api/pedidos" });
    expect(pedidos.json().emAberto.map((pedido: { numero: string }) => pedido.numero)).toEqual(["100001"]);
  });

  it("traz os itens de cada pedido e de cada nota de A, para a linha abrir na própria lista", async () => {
    const app = criarApp({ foto, sessaoDe: LOGIN_DE_A });
    const { emAberto, faturados } = (await app.inject({ method: "GET", url: "/api/pedidos" })).json();
    expect(emAberto[0].itensEmAberto).toEqual([
      { ordem: 1, codigo: "F-100", familia: "FLEXIL", pecas: 1_000, entrega: "2026-10-20", valor: 3_000 },
      { ordem: 2, codigo: "P-200", familia: "PRESIL", pecas: 500, entrega: "2026-10-27", valor: 2_000 },
    ]);
    expect(faturados).toMatchObject([
      { numero: "100002", pedidos: ["100001"], itens: [{ ordem: 1, codigo: "F-100", familia: "FLEXIL", pecas: 100, valor: 1_000 }] },
    ]);
  });

  it("explica o selo em risco com a queda do semestre da foto", async () => {
    const app = criarApp({ foto, sessaoDe: LOGIN_DE_A });
    const situacao = (await app.inject({ method: "GET", url: "/api/situacao" })).json();
    expect(situacao.semestre).toEqual({ inicio: "2026-04", fim: "2026-09" });
    const clientes: { codigo: string; quedaNoSemestre: number | null }[] = (await app.inject({ method: "GET", url: "/api/clientes" })).json();
    expect(clientes.find(({ codigo }) => codigo === CLIENTE_DE_A)?.quedaNoSemestre).toBe(-0.5);
  });

  it("marca o cliente negativo de A, que continua na carteira", async () => {
    const app = criarApp({ foto, sessaoDe: LOGIN_DE_A });
    const clientes: { codigo: string; isNegativo: boolean }[] = (await app.inject({ method: "GET", url: "/api/clientes" })).json();
    expect(clientes.map(({ codigo, isNegativo }) => [codigo, isNegativo]).sort()).toEqual([
      [CLIENTE_DE_A, false],
      [CLIENTE_NEGATIVO_DE_A, true],
    ]);
  });

  it("recusa o código de cliente fora do formato do id", async () => {
    const app = criarApp({ foto, sessaoDe: LOGIN_DE_A });
    const resposta = await app.inject({ method: "GET", url: "/api/clientes/591328580003" });
    expect(resposta.statusCode).toBe(400);
  });
});
