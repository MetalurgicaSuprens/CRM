import fs from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dataDoMomento, momentoEmBrasilia, somarDias } from "dominio/datas";
import { criarAppDoAdmin } from "./admin/appDoAdmin.ts";
import { criarApp } from "./app.ts";
import { abrirBancoDoApp } from "./bancoDoApp.ts";
import { criarFotoAtual, type FotoAtual } from "./foto/fotoAtual.ts";
import type { Analises, ClienteResumo, FichaCliente, PainelDePedidos, Rascunho } from "../../web/src/dados/tipos.ts";
import {
  CLIENTE_DE_A,
  CLIENTE_DE_B,
  CLIENTE_INATIVO_DE_A,
  FILIAL_BAHIA_DE_A,
  FILIAL_CURITIBA_DE_A,
  FILIAL_DE_B,
  GRUPO_DE_A,
  GRUPO_DE_B,
  MARCAS_DE_B,
  gravarFotoDeTeste,
} from "./fotoDeTeste.ts";
import { entrarComo, entrarComoAdmin } from "./login/loginDeTeste.ts";

const ORIGEM = "http://localhost:5175";
const ORIGEM_DO_ADMIN = "http://localhost:5179";

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

const RASCUNHO = "3f1c2b8e-5d4a-4c6b-9e7f-0a1b2c3d4e5f";

/** Um rascunho válido de A: 300 peças do F-100 pelo preço da última compra, acima da tabela (95,50). */
function rascunhoDeA(parcial: object = {}) {
  return { codigoCliente: CLIENTE_DE_A, itens: [{ codigo: "F-100", quantidade: 300, precoCento: 98.4 }], entrega: null, observacao: "", ...parcial };
}

function salvarComoA(app: FastifyInstance, id: string, corpo: object, origem = ORIGEM) {
  return app.inject({ method: "PUT", url: `/api/rascunhos/${id}`, headers: { cookie: loginDeA, origin: origem }, payload: corpo });
}

/** O login B e um rascunho dele, no cliente dele: devolve o id. */
async function criarRascunhoDeB(app: FastifyInstance): Promise<string> {
  const id = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
  const loginDeB = entrarComo(banco, ["9999"]);
  const resposta = await app.inject({
    method: "PUT",
    url: `/api/rascunhos/${id}`,
    headers: { cookie: loginDeB, origin: ORIGEM },
    payload: { codigoCliente: CLIENTE_DE_B, itens: [{ codigo: "PRODUTO-SO-DE-B", quantidade: 50, precoCento: 82 }], entrega: null, observacao: "" },
  });
  expect(resposta.statusCode, resposta.body).toBe(200);
  return id;
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
    const rascunhoDeB = await criarRascunhoDeB(app);
    expect(app.rotasRegistradas.length).toBeGreaterThan(0);
    for (const { metodo, url } of app.rotasRegistradas) {
      // No rascunho de B, o corpo é um rascunho válido de A: nem assim ele aparece ou muda.
      const corpo = metodo === "GET" ? undefined : url.includes(":id") ? rascunhoDeA() : {};
      const comB = url.replace(":codigo", CLIENTE_DE_B).replace(":id", rascunhoDeB);
      const resposta = await app.inject({ method: metodo, url: comB, headers: { cookie: loginDeA, origin: ORIGEM }, payload: corpo });
      if (url.includes(":codigo") || url.includes(":id")) expect(resposta.statusCode, url).toBe(404);
      else if (metodo === "GET") expect(resposta.statusCode, url).toBe(200);
      for (const marca of MARCAS_DE_B) expect(resposta.body, `${metodo} ${url} mostrou ${marca}`).not.toContain(marca);
    }
  });

  it("mostra a A a própria carteira e a ficha do cliente dele", async () => {
    const app = criarAppDeTeste();
    const clientes = await comoA(app, "/api/clientes");
    expect(clientes.json()).toHaveLength(3);
    const ficha = await comoA(app, `/api/clientes/${CLIENTE_DE_A}`);
    expect(ficha.statusCode).toBe(200);
    expect(ficha.json()).toMatchObject({
      nome: "CLIENTE DE A",
      codigoErp: "123456780001",
      familias: [{ familia: "FLEXIL", valor: 12_000, participacao: 1, pecas: 4_000 }],
    });
  });

  it("dá na ficha os pedidos em aberto e os faturados do cliente, só os atribuídos a A", async () => {
    const app = criarAppDeTeste();
    const { pedidos } = (await comoA(app, `/api/clientes/${CLIENTE_DE_A}`)).json();
    // O 999004 é do mesmo cliente, mas de B: fica de fora, como o pedido em aberto de outro representante.
    expect(pedidos).toEqual([
      {
        id: "100001",
        cnpj: null,
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
        cnpj: null,
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
    expect(painel.json().pedidosEmAberto).toEqual({ quantidade: 3, valor: 10_000 });
    // Faturado de outubro (1.000) mais o ritmo de A (1.000 por dia útil) nos 13 dias úteis que faltam.
    expect(painel.json().mesAtual.projecao).toEqual({ valor: 14_000, base: "ritmo" });
    const pedidos = await comoA(app, "/api/pedidos");
    expect(pedidos.json().emAberto.map((pedido: { numero: string }) => pedido.numero)).toEqual(["100001", "100004"]);
  });

  it("dá no Início a história de 60 meses dos códigos do login, sem a de B", async () => {
    const historico: { mes: string; valor: number }[] = (await comoA(criarAppDeTeste(), "/api/painel")).json().historico;
    expect(historico).toHaveLength(60);
    expect(historico[0]).toEqual({ mes: "2021-10", valor: 1_000 });
    expect(historico.at(-1)).toEqual({ mes: "2026-09", valor: 1_000 });
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

  it("dá o endereço da empresa com o ponto no mapa; o grupo fica sem endereço", async () => {
    const clientes: ClienteResumo[] = (await comoA(criarAppDeTeste(), "/api/clientes")).json();
    expect(clientes.find(({ codigo }) => codigo === CLIENTE_DE_A)?.endereco).toEqual({
      texto: "R BARAO DE JAGUARA, 1200 SALA 3",
      bairro: "CENTRO",
      cep: "13015002",
      ponto: { latitude: -22.9, longitude: -47.06, precisao: "numero" },
    });
    expect(clientes.find(({ codigo }) => codigo === GRUPO_DE_A)?.endereco).toBeNull();
  });

  it("mostra o status do cadastro: o cliente inativo de A continua na carteira", async () => {
    const app = criarAppDeTeste();
    const clientes: { codigo: string; status: string }[] = (await comoA(app, "/api/clientes")).json();
    expect(clientes.map(({ codigo, status }) => [codigo, status]).sort()).toEqual([
      [CLIENTE_DE_A, "ativo"],
      [CLIENTE_INATIVO_DE_A, "inativo"],
      [GRUPO_DE_A, "ativo"],
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
        {
          codigo: "F-100",
          familia: "FLEXIL",
          medida: "14–22 mm",
          embalagem: 100,
          precoDaTabela: 95.5,
          ultimaCompra: { precoCento: 98.4, data: "2026-09-15" },
          partNumbers: ["CF420118", "N906227"],
          jaComprou: true,
        },
        // Produto sem EAN: qualquer quantidade de peças. Sem part number na Bíblia, a lista vem vazia; sem compra, sem última compra.
        { codigo: "P-200", familia: "PRESIL", medida: null, embalagem: 1, precoDaTabela: 120, ultimaCompra: null, partNumbers: [], jaComprou: false },
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

describe("grupos do SGI: os CNPJs do mesmo grupo como um cliente só", () => {
  it("lista o grupo no lugar dos CNPJs, com eles do que mais fatura ao que menos", async () => {
    const clientes: ClienteResumo[] = (await comoA(criarAppDeTeste(), "/api/clientes")).json();
    const grupo = clientes.find(({ codigo }) => codigo === GRUPO_DE_A);
    expect(grupo).toMatchObject({ nome: "GRUPO DE A", codigoErp: null, faturamento12m: 30_000 });
    expect(grupo?.cnpjs?.map(({ codigo, cnpjs }) => [codigo, cnpjs])).toEqual([
      [FILIAL_CURITIBA_DE_A, null],
      [FILIAL_BAHIA_DE_A, null],
    ]);
    expect(clientes.map(({ codigo }) => codigo)).not.toContain(FILIAL_BAHIA_DE_A);
  });

  it("dá na ficha do grupo os CNPJs e os pedidos de todos eles, cada um com o seu CNPJ", async () => {
    const ficha: FichaCliente = (await comoA(criarAppDeTeste(), `/api/clientes/${GRUPO_DE_A}`)).json();
    expect(ficha.cnpjs).toHaveLength(2);
    expect(ficha.grupo).toBeNull();
    expect(ficha.pedidos.map(({ numero, cnpj }) => [numero, cnpj?.nome])).toEqual([
      ["100004", "FILIAL BAHIA DE A"],
      ["100005", "FILIAL CURITIBA DE A"],
    ]);
  });

  it("leva da ficha do CNPJ à do grupo", async () => {
    const ficha: FichaCliente = (await comoA(criarAppDeTeste(), `/api/clientes/${FILIAL_BAHIA_DE_A}`)).json();
    expect(ficha).toMatchObject({ nome: "FILIAL BAHIA DE A", cnpjs: null, grupo: { codigo: GRUPO_DE_A, nome: "GRUPO DE A" } });
  });

  it("traz nas análises o grupo, com os CNPJs dele", async () => {
    const { novos }: Analises = (await comoA(criarAppDeTeste(), "/api/analises")).json();
    expect(novos.map(({ cliente }) => [cliente.codigo, cliente.cnpjs?.length ?? null])).toEqual([
      [CLIENTE_DE_A, null],
      [GRUPO_DE_A, 2],
    ]);
  });

  it("não dá catálogo ao grupo, porque o pedido é sempre de um CNPJ", async () => {
    const app = criarAppDeTeste();
    expect((await comoA(app, `/api/clientes/${GRUPO_DE_A}/catalogo`)).statusCode).toBe(404);
    expect((await comoA(app, `/api/clientes/${FILIAL_BAHIA_DE_A}/catalogo`)).statusCode).toBe(200);
  });

  it("não mostra a A o grupo de B nem o CNPJ dele", async () => {
    const app = criarAppDeTeste();
    for (const codigo of [GRUPO_DE_B, FILIAL_DE_B]) {
      for (const url of [`/api/clientes/${codigo}`, `/api/clientes/${codigo}/catalogo`]) {
        expect((await comoA(app, url)).statusCode, url).toBe(404);
      }
    }
  });
});

describe("visitas: o dia em que o representante visitou o cliente", () => {
  const hoje = () => dataDoMomento(momentoEmBrasilia());
  const visitar = (app: FastifyInstance, metodo: "POST" | "DELETE", codigo: string, corpo: object = {}, origem: string = ORIGEM) =>
    app.inject({ method: metodo, url: `/api/clientes/${codigo}/visitas`, headers: { cookie: loginDeA, origin: origem }, payload: corpo });

  it("marca a visita de hoje no cliente de A e a mostra na ficha e nas últimas visitas", async () => {
    const app = criarAppDeTeste();
    const resposta = await visitar(app, "POST", CLIENTE_DE_A);
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ visitas: [hoje()] });
    expect((await comoA(app, "/api/visitas")).json()).toEqual({ [CLIENTE_DE_A]: hoje() });
    expect((await comoA(app, `/api/clientes/${CLIENTE_DE_A}`)).json<FichaCliente>().visitas).toEqual([hoje()]);
  });

  it("não duplica o mesmo dia e aceita um dia dos últimos 30", async () => {
    const app = criarAppDeTeste();
    const ontem = somarDias(hoje(), -1);
    await visitar(app, "POST", CLIENTE_DE_A);
    await visitar(app, "POST", CLIENTE_DE_A);
    expect((await visitar(app, "POST", CLIENTE_DE_A, { data: ontem })).json()).toEqual({ visitas: [hoje(), ontem] });
  });

  it("desfaz a visita do dia", async () => {
    const app = criarAppDeTeste();
    await visitar(app, "POST", CLIENTE_DE_A);
    expect((await visitar(app, "DELETE", CLIENTE_DE_A, { data: hoje() })).json()).toEqual({ visitas: [] });
  });

  it("marca no CNPJ do grupo, e a ficha do grupo junta as visitas dos CNPJs; no grupo em si, 404", async () => {
    const app = criarAppDeTeste();
    expect((await visitar(app, "POST", FILIAL_BAHIA_DE_A)).statusCode).toBe(200);
    expect((await visitar(app, "POST", GRUPO_DE_A)).statusCode).toBe(404);
    expect((await comoA(app, `/api/clientes/${GRUPO_DE_A}`)).json<FichaCliente>().visitas).toEqual([hoje()]);
  });

  it("não deixa A marcar visita no cliente, no grupo ou no CNPJ de B", async () => {
    const app = criarAppDeTeste();
    for (const codigo of [CLIENTE_DE_B, GRUPO_DE_B, FILIAL_DE_B]) {
      expect((await visitar(app, "POST", codigo)).statusCode, codigo).toBe(404);
    }
    expect((await comoA(app, "/api/visitas")).json()).toEqual({});
  });

  it("recusa a data futura, a de mais de 30 dias, a que não existe e a fora do formato", async () => {
    const app = criarAppDeTeste();
    for (const data of [somarDias(hoje(), 1), somarDias(hoje(), -31), "2026-02-30", "18/10/2026"]) {
      expect((await visitar(app, "POST", CLIENTE_DE_A, { data })).statusCode, data).toBe(400);
    }
    expect((await comoA(app, "/api/visitas")).json()).toEqual({});
  });

  it("recusa a visita pedida de outra origem", async () => {
    const resposta = await visitar(criarAppDeTeste(), "POST", CLIENTE_DE_A, {}, "https://outro.exemplo");
    expect(resposta.statusCode).toBe(403);
  });

  it("registra a visita e o desfazer na auditoria, com o id do cliente", async () => {
    const app = criarAppDeTeste();
    await visitar(app, "POST", CLIENTE_DE_A);
    await visitar(app, "DELETE", CLIENTE_DE_A, { data: hoje() });
    const eventos = banco.prepare("SELECT evento, alvo FROM auditoria WHERE evento LIKE 'visita_%' ORDER BY id").all();
    expect(eventos.map(({ evento, alvo }) => [evento, alvo])).toEqual([
      ["visita_registrada", CLIENTE_DE_A],
      ["visita_desfeita", CLIENTE_DE_A],
    ]);
  });
});

describe("entrada hostil: o campo que o schema não lista é recusado, e não apagado", () => {
  /** A API da administração, com a sessão de um admin. */
  const administracao = () => ({ admin: criarAppDoAdmin({ foto, banco, origem: ORIGEM_DO_ADMIN, origemDoCrm: ORIGEM }), cookie: entrarComoAdmin(banco).cookie });

  it("recusa a visita com o código de representante no corpo, e o mesmo pedido sem ele passa", async () => {
    const app = criarAppDeTeste();
    const visitar = (corpo: object) =>
      app.inject({ method: "POST", url: `/api/clientes/${CLIENTE_DE_A}/visitas`, headers: { cookie: loginDeA, origin: ORIGEM }, payload: corpo });
    expect((await visitar({ representante: "9999" })).statusCode).toBe(400);
    expect((await comoA(app, "/api/visitas")).json()).toEqual({});
    expect((await visitar({})).statusCode).toBe(200);
  });

  it("na administração, recusa o login novo com o papel no corpo, e o mesmo pedido sem ele cria o login", async () => {
    const { admin, cookie } = administracao();
    const criarLogin = (corpo: object) => admin.inject({ method: "POST", url: "/api/admin/logins", headers: { cookie, origin: ORIGEM_DO_ADMIN }, payload: corpo });
    const novo = { nome: "Outra Representação", codigos: ["9999"] };
    expect((await criarLogin({ ...novo, papel: "admin" })).statusCode).toBe(400);
    // 201, e não 409: o pedido recusado não ligou o 9999 a login nenhum.
    expect((await criarLogin(novo)).statusCode).toBe(201);
  });

  it("na administração, recusa também o parâmetro que a busca do registro não lista", async () => {
    const { admin, cookie } = administracao();
    const buscar = (busca: string) => admin.inject({ method: "GET", url: `/api/admin/registro?${busca}`, headers: { cookie } });
    expect((await buscar("antes=5&ordem=asc")).statusCode).toBe(400);
    expect((await buscar("antes=5")).statusCode).toBe(200);
  });
});

describe("rascunhos: o pedido em montagem fica no servidor, do login", () => {
  it("salva o rascunho e o devolve com o cliente e o total; ele aparece em Pedidos e na ficha", async () => {
    const app = criarAppDeTeste();
    const resposta = await salvarComoA(app, RASCUNHO, rascunhoDeA());
    expect(resposta.statusCode, resposta.body).toBe(200);
    expect(resposta.json()).toMatchObject({
      id: RASCUNHO,
      cliente: { codigo: CLIENTE_DE_A },
      itens: [{ codigo: "F-100", quantidade: 300, precoCento: 98.4 }],
      entrega: null,
      totalEstimado: 295.2,
    });
    expect((await comoA(app, `/api/rascunhos/${RASCUNHO}`)).json<Rascunho>().itens).toEqual([{ codigo: "F-100", quantidade: 300, precoCento: 98.4 }]);
    expect((await comoA(app, "/api/pedidos")).json<PainelDePedidos>().rascunhos.map(({ id }) => id)).toEqual([RASCUNHO]);
    expect((await comoA(app, `/api/clientes/${CLIENTE_DE_A}`)).json<FichaCliente>().pedidos[0]).toMatchObject({
      id: RASCUNHO,
      status: "rascunho",
      numero: null,
      valor: 295.2,
      itens: [{ codigo: "F-100", familia: "FLEXIL", pecas: 300, valor: 295.2 }],
    });
  });

  it("salvar de novo com o mesmo id atualiza o rascunho, sem duplicar, e troca os itens", async () => {
    const app = criarAppDeTeste();
    await salvarComoA(app, RASCUNHO, rascunhoDeA());
    const segunda = await salvarComoA(app, RASCUNHO, rascunhoDeA({ itens: [{ codigo: "P-200", quantidade: 7, precoCento: 130 }], entrega: "2027-01-15", observacao: "Entregar\nna portaria" }));
    expect(segunda.statusCode, segunda.body).toBe(200);
    expect(segunda.json()).toMatchObject({ itens: [{ codigo: "P-200", quantidade: 7, precoCento: 130 }], entrega: "2027-01-15", observacao: "Entregar\nna portaria", totalEstimado: 9.1 });
    expect((await comoA(app, "/api/pedidos")).json<PainelDePedidos>().rascunhos).toHaveLength(1);
  });

  it("guarda o rascunho no app.db: outro servidor, no mesmo banco, o encontra", async () => {
    await salvarComoA(criarAppDeTeste(), RASCUNHO, rascunhoDeA());
    expect((await comoA(criarAppDeTeste(), `/api/rascunhos/${RASCUNHO}`)).statusCode).toBe(200);
  });

  it("descarta o rascunho; depois dele, 404", async () => {
    const app = criarAppDeTeste();
    await salvarComoA(app, RASCUNHO, rascunhoDeA());
    const descarte = await app.inject({ method: "DELETE", url: `/api/rascunhos/${RASCUNHO}`, headers: { cookie: loginDeA, origin: ORIGEM } });
    expect(descarte.statusCode).toBe(204);
    expect((await comoA(app, `/api/rascunhos/${RASCUNHO}`)).statusCode).toBe(404);
    expect((await comoA(app, "/api/pedidos")).json<PainelDePedidos>().rascunhos).toEqual([]);
  });

  it("recusa o produto fora do catálogo, o preço abaixo da tabela, o produto repetido e a data que não existe", async () => {
    const app = criarAppDeTeste();
    const casos: [object, RegExp][] = [
      [{ itens: [{ codigo: "PRODUTO-SO-DE-B", quantidade: 10, precoCento: 90 }] }, /não está no catálogo/],
      [{ itens: [{ codigo: "F-100", quantidade: 10, precoCento: 95.49 }] }, /abaixo da tabela do cliente/],
      [{ itens: [{ codigo: "F-100", quantidade: 10, precoCento: 96 }, { codigo: "F-100", quantidade: 20, precoCento: 96 }] }, /duas vezes/],
      [{ entrega: "2027-02-30" }, /não existe/],
    ];
    for (const [parcial, erro] of casos) {
      const resposta = await salvarComoA(app, RASCUNHO, rascunhoDeA(parcial));
      expect(resposta.statusCode, JSON.stringify(parcial)).toBe(400);
      expect(resposta.json().erro).toMatch(erro);
    }
  });

  it("aceita o preço igual à tabela, que é o mínimo", async () => {
    const resposta = await salvarComoA(criarAppDeTeste(), RASCUNHO, rascunhoDeA({ itens: [{ codigo: "F-100", quantidade: 100, precoCento: 95.5 }] }));
    expect(resposta.statusCode, resposta.body).toBe(200);
  });

  it("não cria rascunho vazio, mas deixa esvaziar o que já existe", async () => {
    const app = criarAppDeTeste();
    expect((await salvarComoA(app, RASCUNHO, rascunhoDeA({ itens: [] }))).statusCode).toBe(400);
    await salvarComoA(app, RASCUNHO, rascunhoDeA());
    expect((await salvarComoA(app, RASCUNHO, rascunhoDeA({ itens: [] }))).statusCode).toBe(200);
  });

  it("recusa o cliente de B e o grupo (404) e o cliente inativo (409, com o aviso)", async () => {
    const app = criarAppDeTeste();
    expect((await salvarComoA(app, RASCUNHO, rascunhoDeA({ codigoCliente: CLIENTE_DE_B }))).statusCode).toBe(404);
    expect((await salvarComoA(app, RASCUNHO, rascunhoDeA({ codigoCliente: GRUPO_DE_A }))).statusCode).toBe(404);
    const inativo = await salvarComoA(app, RASCUNHO, rascunhoDeA({ codigoCliente: CLIENTE_INATIVO_DE_A }));
    expect(inativo.statusCode).toBe(409);
    expect(inativo.json().erro).toMatch(/inativo no cadastro/);
  });

  it("não deixa A ler, salvar por cima nem descartar o rascunho de B", async () => {
    const app = criarAppDeTeste();
    const deB = await criarRascunhoDeB(app);
    expect((await comoA(app, `/api/rascunhos/${deB}`)).statusCode).toBe(404);
    expect((await salvarComoA(app, deB, rascunhoDeA())).statusCode).toBe(404);
    const descarte = await app.inject({ method: "DELETE", url: `/api/rascunhos/${deB}`, headers: { cookie: loginDeA, origin: ORIGEM } });
    expect(descarte.statusCode).toBe(404);
    expect((await comoA(app, "/api/pedidos")).json<PainelDePedidos>().rascunhos).toEqual([]);
  });

  it("recusa o campo a mais, o preço zerado, o id fora do formato e a observação com caractere de controle", async () => {
    const app = criarAppDeTeste();
    expect((await salvarComoA(app, RASCUNHO, { ...rascunhoDeA(), representante: "9999" })).statusCode).toBe(400);
    expect((await salvarComoA(app, RASCUNHO, rascunhoDeA({ itens: [{ codigo: "F-100", quantidade: 10, precoCento: 0 }] }))).statusCode).toBe(400);
    expect((await salvarComoA(app, "R1", rascunhoDeA())).statusCode).toBe(400);
    expect((await salvarComoA(app, RASCUNHO, rascunhoDeA({ observacao: "a\u0000b" }))).statusCode).toBe(400);
  });

  it("recusa o rascunho pedido de outra origem", async () => {
    expect((await salvarComoA(criarAppDeTeste(), RASCUNHO, rascunhoDeA(), "https://outro.exemplo")).statusCode).toBe(403);
  });

  it("registra na auditoria a criação e o descarte, com o id do cliente, e não cada salvamento", async () => {
    const app = criarAppDeTeste();
    await salvarComoA(app, RASCUNHO, rascunhoDeA());
    await salvarComoA(app, RASCUNHO, rascunhoDeA({ observacao: "outra" }));
    await app.inject({ method: "DELETE", url: `/api/rascunhos/${RASCUNHO}`, headers: { cookie: loginDeA, origin: ORIGEM } });
    const eventos = banco.prepare("SELECT evento, alvo FROM auditoria WHERE evento LIKE 'rascunho_%' ORDER BY id").all();
    expect(eventos.map((linha) => ({ ...linha }))).toEqual([
      { evento: "rascunho_criado", alvo: CLIENTE_DE_A },
      { evento: "rascunho_descartado", alvo: CLIENTE_DE_A },
    ]);
  });
});
