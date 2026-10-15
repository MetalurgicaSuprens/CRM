import fs from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "./app.ts";
import { abrirBancoDoApp } from "./bancoDoApp.ts";
import { criarFotoAtual, type FotoAtual } from "./foto/fotoAtual.ts";
import { CLIENTE_DE_A, CLIENTE_DE_B, CLIENTE_INATIVO_DE_A, MARCAS_DE_B, gravarFotoDeTeste } from "./fotoDeTeste.ts";
import { entrarComo } from "./login/loginDeTeste.ts";

const ORIGEM = "http://localhost:5175";

let pasta: string;
let foto: FotoAtual;
let banco: DatabaseSync;
/** O Cookie da sessão do login A, que puxa o código 1401. */
let loginDeA: string;

beforeAll(() => {
  pasta = gravarFotoDeTeste();
  foto = criarFotoAtual(pasta);
});

beforeEach(() => {
  banco = abrirBancoDoApp(":memory:");
  loginDeA = entrarComo(banco, ["1401"]);
});

afterAll(() => {
  foto.fechar();
  fs.rmSync(pasta, { recursive: true, force: true });
});

function criarAppDeTeste(): FastifyInstance {
  return criarApp({ foto, banco, origem: ORIGEM });
}

/** GET como o login A: com o cookie da sessão dele. */
function comoA(app: FastifyInstance, url: string) {
  return app.inject({ method: "GET", url, headers: { cookie: loginDeA } });
}

describe("acesso declarado", () => {
  it("não sobe com uma rota que não declara config.acesso", async () => {
    const app = criarAppDeTeste();
    await expect(async () => {
      app.get("/api/sem-acesso", () => "nada");
      await app.ready();
    }).rejects.toThrow(/config.acesso/);
  });

  it("responde 401 às rotas de representante sem sessão", async () => {
    const app = criarAppDeTeste();
    const rotas = app.rotasRegistradas.filter((rota) => rota.acesso === "representante");
    expect(rotas.length).toBeGreaterThan(0);
    for (const { metodo, url } of rotas) {
      const resposta = await app.inject({ method: metodo, url: url.replace(":codigo", CLIENTE_DE_A), headers: { origin: ORIGEM } });
      expect(resposta.statusCode, url).toBe(401);
    }
  });

  it("responde 401 a um cookie inventado, sem consultar nada", async () => {
    const app = criarAppDeTeste();
    const resposta = await app.inject({ method: "GET", url: "/api/clientes", headers: { cookie: `__Host-crm=${"x".repeat(43)}` } });
    expect(resposta.statusCode).toBe(401);
  });
});

describe("escopo: o login A nunca vê os dados de B", () => {
  it("percorre todas as rotas: ficha de B dá 404, e nenhuma resposta traz B", async () => {
    const app = criarAppDeTeste();
    await app.ready();
    expect(app.rotasRegistradas.length).toBeGreaterThan(0);
    for (const { metodo, url } of app.rotasRegistradas) {
      const resposta = await app.inject({ method: metodo, url: url.replace(":codigo", CLIENTE_DE_B), headers: { cookie: loginDeA, origin: ORIGEM }, payload: metodo === "GET" ? undefined : {} });
      if (url.includes(":codigo")) expect(resposta.statusCode, url).toBe(404);
      else if (metodo === "GET") expect(resposta.statusCode, url).toBe(200);
      for (const marca of MARCAS_DE_B) expect(resposta.body, `${metodo} ${url} mostrou ${marca}`).not.toContain(marca);
    }
  });

  it("mostra a A a própria carteira e a ficha do cliente dele", async () => {
    const app = criarAppDeTeste();
    const clientes = await comoA(app, "/api/clientes");
    expect(clientes.json()).toHaveLength(2);
    const ficha = await comoA(app, `/api/clientes/${CLIENTE_DE_A}`);
    expect(ficha.statusCode).toBe(200);
    expect(ficha.json()).toMatchObject({ nome: "CLIENTE DE A", codigoErp: "123456780001" });
  });

  it("dá na ficha os pedidos em aberto e os faturados do cliente, só os atribuídos a A", async () => {
    const app = criarAppDeTeste();
    const { pedidos } = (await comoA(app, `/api/clientes/${CLIENTE_DE_A}`)).json();
    // O 999004 é do mesmo cliente, mas de B: fica de fora, como o pedido em aberto de outro representante.
    expect(pedidos).toEqual([
      {
        id: "100001",
        numero: "100001",
        status: "em_aberto",
        emissao: "2026-10-01",
        entrega: "2026-10-20",
        itens: [
          { ordem: 1, codigo: "F-100", familia: "FLEXIL", pecas: 1_000, valor: 3_000, entrega: "2026-10-20" },
          { ordem: 2, codigo: "P-200", familia: "PRESIL", pecas: 500, valor: 2_000, entrega: "2026-10-27" },
        ],
        valor: 5_000,
      },
      {
        id: "100003",
        numero: "100003",
        status: "faturado",
        emissao: "2026-09-02",
        entrega: "2026-09-10",
        itens: [
          { ordem: 1, codigo: "F-100", familia: "FLEXIL", pecas: 2_000, valor: 3_000, entrega: null },
          { ordem: 2, codigo: "P-200", familia: "PRESIL", pecas: 1_000, valor: 1_500, entrega: null },
        ],
        valor: 4_500,
      },
    ]);
  });

  it("conta no Início o pedido do A para cliente de outra carteira, sem listá-lo", async () => {
    const app = criarAppDeTeste();
    const painel = await comoA(app, "/api/painel");
    expect(painel.json().pedidosEmAberto).toEqual({ quantidade: 2, valor: 8_000 });
    // Faturado de outubro (1.000) mais o ritmo de A (1.000 por dia útil) nos 13 dias úteis que faltam.
    expect(painel.json().mesAtual.projecao).toEqual({ valor: 14_000, base: "ritmo" });
    const pedidos = await comoA(app, "/api/pedidos");
    expect(pedidos.json().emAberto.map((pedido: { numero: string }) => pedido.numero)).toEqual(["100001"]);
  });

  it("traz os itens de cada pedido e de cada nota de A, para a linha abrir na própria lista", async () => {
    const app = criarAppDeTeste();
    const { emAberto, faturados } = (await comoA(app, "/api/pedidos")).json();
    expect(emAberto[0].itensEmAberto).toEqual([
      { ordem: 1, codigo: "F-100", familia: "FLEXIL", pecas: 1_000, entrega: "2026-10-20", valor: 3_000 },
      { ordem: 2, codigo: "P-200", familia: "PRESIL", pecas: 500, entrega: "2026-10-27", valor: 2_000 },
    ]);
    expect(faturados).toMatchObject([
      { numero: "100002", pedidos: ["100001"], itens: [{ ordem: 1, codigo: "F-100", familia: "FLEXIL", pecas: 100, valor: 1_000 }] },
    ]);
  });

  it("explica o selo em risco com a queda do semestre da foto", async () => {
    const app = criarAppDeTeste();
    const situacao = (await comoA(app, "/api/situacao")).json();
    expect(situacao.semestre).toEqual({ inicio: "2026-04", fim: "2026-09" });
    const clientes: { codigo: string; quedaNoSemestre: number | null }[] = (await comoA(app, "/api/clientes")).json();
    expect(clientes.find(({ codigo }) => codigo === CLIENTE_DE_A)?.quedaNoSemestre).toBe(-0.5);
  });

  it("mostra o status do cadastro: o cliente inativo de A continua na carteira", async () => {
    const app = criarAppDeTeste();
    const clientes: { codigo: string; status: string }[] = (await comoA(app, "/api/clientes")).json();
    expect(clientes.map(({ codigo, status }) => [codigo, status]).sort()).toEqual([
      [CLIENTE_DE_A, "ativo"],
      [CLIENTE_INATIVO_DE_A, "inativo"],
    ]);
  });

  it("dá a A o catálogo do cliente dele, com os preços da lista e o que ele já comprou", async () => {
    const app = criarAppDeTeste();
    const resposta = await comoA(app, `/api/clientes/${CLIENTE_DE_A}/catalogo`);
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({
      cliente: { codigo: CLIENTE_DE_A },
      tabela: "PADRAO - FEV",
      produtos: [
        { codigo: "F-100", familia: "FLEXIL", medida: "14–22 mm", embalagem: 100, precoCento: 95.5, partNumber: "CF420118", jaComprou: true },
        // Produto sem EAN: qualquer quantidade de peças.
        { codigo: "P-200", familia: "PRESIL", medida: null, embalagem: 1, precoCento: 120, partNumber: null, jaComprou: false },
      ],
    });
  });

  it("não dá catálogo ao cliente inativo: 409, com o aviso para pedir a reativação", async () => {
    const app = criarAppDeTeste();
    const resposta = await comoA(app, `/api/clientes/${CLIENTE_INATIVO_DE_A}/catalogo`);
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json().erro).toMatch(/inativo no cadastro da Suprens.*peça a reativação/);
  });

  it("recusa o código de cliente fora do formato do id", async () => {
    const app = criarAppDeTeste();
    const resposta = await comoA(app, "/api/clientes/591328580003");
    expect(resposta.statusCode).toBe(400);
  });
});
