import fs from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dataDoMomento, momentoEmBrasilia, somarDias } from "dominio/datas";
import { AVISO_DE_SEM_TABELA } from "dominio/statusDoCadastro";
import { criarAppDoAdmin } from "./admin/appDoAdmin.ts";
import { criarApp } from "./app.ts";
import { abrirBancoDoApp } from "./bancoDoApp.ts";
import { criarFotoAtual, type FotoAtual } from "./foto/fotoAtual.ts";
import type { Analises, CatalogoDoCliente, ClienteResumo, FichaCliente, PainelDePedidos, Cotacao } from "../../web/src/dados/tipos.ts";
import {
  CLIENTE_DE_A,
  CLIENTE_DE_B,
  CLIENTE_INATIVO_DE_A,
  CLIENTE_SEM_TABELA_DE_A,
  FILIAL_BAHIA_DE_A,
  FILIAL_CURITIBA_DE_A,
  FILIAL_DE_B,
  GRUPO_DE_A,
  GRUPO_DE_B,
  MARCAS_DE_B,
  gravarFotoDeTeste,
  type PastasDeTeste,
} from "./fotoDeTeste.ts";
import { entrarComo, entrarComoAdmin } from "./login/loginDeTeste.ts";

const ORIGEM = "http://localhost:5175";
const ORIGEM_DO_ADMIN = "http://localhost:5179";

/** O que o SGI tem do pedido 100001 na foto de teste. */
const CONDICOES_DO_100001 = {
  numero: "100001",
  transportadora: {
    codigo: "103",
    nome: "VELHA INATIVO",
    razaoSocial: "VELHA TRANSPORTES LTDA",
    cnpj: "33.000.167/0001-01",
    endereco: null,
    bairro: null,
    cep: null,
    cidade: "MARINGA",
    uf: "PR",
  },
  condicaoDePagamento: "30/60 DDL",
  tipoDeEntrega: "programada",
  entrega: "2026-10-20",
  ordemDeCompra: "OC-DE-A",
  classificacao: "industrializacao",
  aceitaParcial: false,
  pagamentoDoFrete: "T",
  observacao: "Entregar pela manhã.",
  temItemDaOrdemDeCompra: true,
};

let pastas: PastasDeTeste;
let foto: FotoAtual;
let banco: DatabaseSync;
/** O Cookie da sessão do login A, que puxa o código 1401. */
let loginDeA: string;

beforeAll(() => {
  pastas = gravarFotoDeTeste();
  foto = criarFotoAtual(pastas);
});

beforeEach(() => {
  banco = abrirBancoDoApp(":memory:");
  loginDeA = entrarComo(banco, ["1401"]);
});

afterAll(() => {
  foto.fechar();
  fs.rmSync(pastas.raiz, { recursive: true, force: true });
});

function criarAppDeTeste(): FastifyInstance {
  return criarApp({ foto, banco, origem: ORIGEM });
}

/** GET como o login A: com o cookie da sessão dele. */
function comoA(app: FastifyInstance, url: string) {
  return app.inject({ method: "GET", url, headers: { cookie: loginDeA } });
}

const COTACAO = "3f1c2b8e-5d4a-4c6b-9e7f-0a1b2c3d4e5f";

/** Uma cotação válida de A: 300 peças do F-100 pelo preço da última compra, acima da tabela (95,50). */
function cotacaoDeA(parcial: object = {}) {
  return { codigoCliente: CLIENTE_DE_A, itens: [{ codigo: "F-100", quantidade: 300, precoCento: 98.4, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null }], entrega: null, observacao: "", ...parcial };
}

function salvarComoA(app: FastifyInstance, id: string, corpo: object, origem = ORIGEM) {
  return app.inject({ method: "PUT", url: `/api/cotacoes/${id}`, headers: { cookie: loginDeA, origin: origem }, payload: corpo });
}

/** Uma credencial no formato certo, que nenhum aparelho assinou: só passa do schema. */
const CREDENCIAL_DE_MENTIRA = {
  id: "abc",
  rawId: "abc",
  type: "public-key",
  clientExtensionResults: {},
  response: { clientDataJSON: "e30", authenticatorData: "AA", signature: "AA" },
};

/** Um pedido enviado de B, gravado direto no app.db (o envio de verdade está em envio/envio.test.ts): devolve o número. */
function gravarPedidoEnviadoDeB(): string {
  const usuario = String(banco.prepare("SELECT usuario FROM usuario_codigos WHERE codigo = '9999'").get()?.usuario);
  const conteudo = { cliente: CLIENTE_DE_B, itens: [{ codigo: "PRODUTO-SO-DE-B", quantidade: 50, precoCento: 82, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null }], entrega: null, observacao: "", escolhas: null };
  banco
    .prepare("INSERT INTO pedidos_enviados (usuario, cliente, cotacao, conteudo, hash, chave, assinatura, enviado_em) VALUES (?, ?, ?, ?, '', ?, '{}', ?)")
    .run(usuario, CLIENTE_DE_B, "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e", JSON.stringify(conteudo), `chave-de-${usuario}`, "2026-10-14T09:00:00");
  return "CRM-00001";
}

/** O corpo de cada rota que grava: na cotação de B, uma cotação válida de A ou uma confirmação no formato certo. */
function corpoDaRota(metodo: string, url: string): object | undefined {
  if (metodo === "GET" || url.endsWith("/envio/opcoes")) return undefined;
  if (url.endsWith("/envio")) return { resposta: CREDENCIAL_DE_MENTIRA };
  return url.includes(":id") ? cotacaoDeA() : {};
}

/** O login B e uma cotação dele, no cliente dele: devolve o id. */
async function criarCotacaoDeB(app: FastifyInstance): Promise<string> {
  const id = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
  const loginDeB = entrarComo(banco, ["9999"]);
  const resposta = await app.inject({
    method: "PUT",
    url: `/api/cotacoes/${id}`,
    headers: { cookie: loginDeB, origin: ORIGEM },
    payload: { codigoCliente: CLIENTE_DE_B, itens: [{ codigo: "PRODUTO-SO-DE-B", quantidade: 50, precoCento: 82, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null }], entrega: null, observacao: "" },
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
    const cotacaoDeB = await criarCotacaoDeB(app);
    const pedidoDeB = gravarPedidoEnviadoDeB();
    expect(app.rotasRegistradas.length).toBeGreaterThan(0);
    for (const { metodo, url } of app.rotasRegistradas) {
      // Na cotação de B, o corpo é uma cotação válida de A: nem assim ele aparece ou muda.
      const corpo = corpoDaRota(metodo, url);
      const comB = url.replace(":codigo", CLIENTE_DE_B).replace(":id", cotacaoDeB).replace(":numero", pedidoDeB);
      const resposta = await app.inject({ method: metodo, url: comB, headers: { cookie: loginDeA, origin: ORIGEM }, payload: corpo });
      if (/:(codigo|id|numero)/.test(url)) expect(resposta.statusCode, url).toBe(404);
      else if (metodo === "GET") expect(resposta.statusCode, url).toBe(200);
      for (const marca of MARCAS_DE_B) expect(resposta.body, `${metodo} ${url} mostrou ${marca}`).not.toContain(marca);
    }
  });

  it("mostra a A a própria carteira e a ficha do cliente dele", async () => {
    const app = criarAppDeTeste();
    const clientes = await comoA(app, "/api/clientes");
    expect(clientes.json()).toHaveLength(4);
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
          { ordem: 1, codigo: "F-100", familia: "FLEXIL", pecas: 1_000, valor: 3_000, entrega: "2026-10-20", ordemDeCompra: null, itemDaOrdemDeCompra: 1, partNumber: "01853" },
          { ordem: 2, codigo: "P-200", familia: "PRESIL", pecas: 500, valor: 2_000, entrega: "2026-10-27", ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null },
        ],
        valor: 5_000,
        valorComIpi: 5_250,
        cfop: { codigo: "6101", descricao: "VENDA DE PRODUCAO DO ESTABELECIMENTO" },
        notas: [],
        condicoes: CONDICOES_DO_100001,
      },
      {
        id: "100003",
        cnpj: null,
        numero: "100003",
        status: "faturado",
        emissao: "2026-09-02",
        entrega: "2026-09-10",
        itens: [
          { ordem: 1, codigo: "F-100", familia: "FLEXIL", pecas: 2_000, valor: 3_000, entrega: null, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null },
          { ordem: 2, codigo: "P-200", familia: "PRESIL", pecas: 1_000, valor: 1_500, entrega: null, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null },
        ],
        valor: 4_500,
        valorComIpi: 4_725,
        cfop: { codigo: "6101", descricao: "VENDA DE PRODUCAO DO ESTABELECIMENTO" },
        notas: [{ numero: "100013", emissao: "2026-09-10", valorTotal: 4_725, transportadora: "RODONAVES" }],
        condicoes: null,
      },
    ]);
  });

  it("dá na ficha o cadastro fiscal do cliente, como na tela de pedido, e nenhum no grupo", async () => {
    const app = criarAppDeTeste();
    const { cadastro } = (await comoA(app, `/api/clientes/${CLIENTE_DE_A}`)).json();
    expect(cadastro).toMatchObject({ documento: "12.345.678/0001-95" });
    expect((await comoA(app, `/api/clientes/${GRUPO_DE_A}`)).json().cadastro).toBeNull();
  });

  it("dá nas notas da aba Faturados o total com os impostos, o IPI, a transportadora e o CFOP", async () => {
    const app = criarAppDeTeste();
    const [nota] = (await comoA(app, "/api/pedidos")).json().faturados;
    expect(nota).toMatchObject({
      numero: "100002",
      valor: 1_000,
      valorIpi: 50,
      valorTotal: 1_050,
      transportadora: "RODONAVES",
      cfop: { codigo: "5101", descricao: "VENDA DE PRODUCAO DO ESTABELECIMENTO" },
    });
    expect(nota.cliente.cnpj).toBe("12.345.678/0001-95");
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
      { ordem: 1, codigo: "F-100", familia: "FLEXIL", pecas: 1_000, entrega: "2026-10-20", valor: 3_000, ordemDeCompra: null, itemDaOrdemDeCompra: 1, partNumber: "01853" },
      { ordem: 2, codigo: "P-200", familia: "PRESIL", pecas: 500, entrega: "2026-10-27", valor: 2_000, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null },
    ]);
    expect(faturados).toMatchObject([
      { numero: "100002", pedidos: ["100001"], itens: [{ ordem: 1, codigo: "F-100", familia: "FLEXIL", pecas: 100, valor: 1_000, partNumber: "01853" }] },
    ]);
  });

  it("dá no pedido do ERP e na nota o que foi preenchido no SGI, com a transportadora inativa inteira", async () => {
    const { emAberto, faturados } = (await comoA(criarAppDeTeste(), "/api/pedidos")).json();
    expect(emAberto[0].condicoes).toEqual(CONDICOES_DO_100001);
    expect(faturados[0].condicoes).toEqual([CONDICOES_DO_100001]);
    expect(emAberto[1].condicoes).toBeNull();
  });

  it("não oferece no pedido novo a transportadora inativa", async () => {
    const catalogo = (await comoA(criarAppDeTeste(), `/api/clientes/${CLIENTE_DE_A}/catalogo`)).json();
    expect(catalogo.dadosDoPedido.transportadoras.map(({ codigo }: { codigo: string }) => codigo)).toEqual(["102", "101"]);
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
      [CLIENTE_SEM_TABELA_DE_A, "ativo"],
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
          partNumberDoCliente: { opcoes: ["01853"], sugerido: "01853" },
          pesoKg: 0.02175,
          jaComprou: true,
        },
        // Produto sem EAN: qualquer quantidade de peças. Sem part number na Bíblia, a lista vem vazia; sem compra, sem última compra.
        {
          codigo: "P-200",
          familia: "PRESIL",
          medida: null,
          embalagem: 1,
          precoDaTabela: 120,
          ultimaCompra: null,
          partNumbers: [],
          partNumberDoCliente: { opcoes: [], sugerido: null },
          pesoKg: null,
          jaComprou: false,
        },
      ],
      representante: { codigo: "1401", nome: "STAR VENDAS" },
    });
    expect(resposta.json<CatalogoDoCliente>().dadosDoPedido?.transportadoras[1]).toMatchObject({ razaoSocial: "TRANSPORTES IPE LTDA", endereco: "R. SOLEDADE, 228", cep: "07224210" });
  });

  it("leva no catálogo os dados da tela de pedido: o cadastro, o histórico de escolhas, o IPI e o último pedido", async () => {
    const resposta = await comoA(criarAppDeTeste(), `/api/clientes/${CLIENTE_DE_A}/catalogo`);
    const { dadosDoPedido } = resposta.json<CatalogoDoCliente>();
    expect(dadosDoPedido).toMatchObject({
      cadastro: {
        razaoSocial: "CLIENTE DE A LTDA",
        documento: "12.345.678/0001-95",
        telefone: "(19) 3232-1000",
        faturamento: { texto: "R BARAO DE JAGUARA, 1200 SALA 3", cidade: "CAMPINAS", uf: "SP", cep: "13015002" },
        cobranca: null,
        entrega: { razaoSocial: "CLIENTE DE A LTDA", cidade: "VALINHOS" },
      },
      condicaoDoCadastro: "1002",
      condicoesUsadas: [{ valor: "1002", pedidos: 10 }],
      classificacoesUsadas: [{ valor: "industrializacao", pedidos: 10 }],
      parcialUsado: { aceita: 7, naoAceita: 3 },
      transportadorasDoCliente: [
        { valor: "101", pedidos: 9 },
        { valor: "102", pedidos: 1 },
      ],
      transportadorasDoRepresentante: [{ valor: "101", pedidos: 40 }],
      ipi: { "F-100": 5, "P-200": 9.75 },
      ultimoPedido: {
        data: "2026-09-02",
        itens: [
          { codigo: "P-200", quantidade: 300 },
          { codigo: "F-100", quantidade: 500 },
        ],
      },
    });
    expect(dadosDoPedido?.transportadoras.map(({ codigo }) => codigo)).toEqual(["102", "101"]);
  });

  it("não leva dados da tela de pedido ao cliente sem cadastro na foto", async () => {
    const resposta = await comoA(criarAppDeTeste(), `/api/clientes/${FILIAL_BAHIA_DE_A}/catalogo`);
    expect(resposta.json<CatalogoDoCliente>().dadosDoPedido).toBeNull();
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

describe("cotações: o pedido em montagem fica no servidor, do login", () => {
  it("salva a cotação e a devolve com o cliente e o total; ela aparece em Pedidos e na ficha", async () => {
    const app = criarAppDeTeste();
    const resposta = await salvarComoA(app, COTACAO, cotacaoDeA());
    expect(resposta.statusCode, resposta.body).toBe(200);
    expect(resposta.json()).toMatchObject({
      id: COTACAO,
      cliente: { codigo: CLIENTE_DE_A },
      itens: [{ codigo: "F-100", quantidade: 300, precoCento: 98.4, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null }],
      entrega: null,
      totalEstimado: 295.2,
    });
    expect((await comoA(app, `/api/cotacoes/${COTACAO}`)).json<Cotacao>().itens).toEqual([{ codigo: "F-100", quantidade: 300, precoCento: 98.4, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null }]);
    expect((await comoA(app, "/api/pedidos")).json<PainelDePedidos>().cotacoes.map(({ id }) => id)).toEqual([COTACAO]);
    expect((await comoA(app, `/api/clientes/${CLIENTE_DE_A}`)).json<FichaCliente>().pedidos[0]).toMatchObject({
      id: COTACAO,
      status: "cotacao",
      numero: null,
      valor: 295.2,
      itens: [{ codigo: "F-100", familia: "FLEXIL", pecas: 300, valor: 295.2 }],
    });
  });

  it("guarda o part number do item, o vazio como sem part number, e recusa o longo demais", async () => {
    const app = criarAppDeTeste();
    const item = { codigo: "F-100", quantidade: 300, precoCento: 98.4, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: "232.407-9RF" };
    expect((await salvarComoA(app, COTACAO, cotacaoDeA({ itens: [item] }))).statusCode).toBe(200);
    expect((await comoA(app, `/api/cotacoes/${COTACAO}`)).json<Cotacao>().itens).toEqual([item]);
    expect((await salvarComoA(app, COTACAO, cotacaoDeA({ itens: [{ ...item, partNumber: "" }] }))).statusCode).toBe(200);
    expect((await comoA(app, `/api/cotacoes/${COTACAO}`)).json<Cotacao>().itens[0]?.partNumber).toBeNull();
    expect((await salvarComoA(app, COTACAO, cotacaoDeA({ itens: [{ ...item, partNumber: "X".repeat(31) }] }))).statusCode).toBe(400);
  });

  it("guarda a ordem de compra e o item dela em cada item, e recusa o item da ordem fora do limite", async () => {
    const app = criarAppDeTeste();
    const item = { codigo: "F-100", quantidade: 300, precoCento: 98.4, ordemDeCompra: "151220/ES", itemDaOrdemDeCompra: 1, partNumber: null };
    expect((await salvarComoA(app, COTACAO, cotacaoDeA({ itens: [item] }))).statusCode).toBe(200);
    expect((await comoA(app, `/api/cotacoes/${COTACAO}`)).json<Cotacao>().itens).toEqual([item]);
    expect((await salvarComoA(app, COTACAO, cotacaoDeA({ itens: [{ ...item, itemDaOrdemDeCompra: 1_000_000, partNumber: null }] }))).statusCode).toBe(400);
    expect((await salvarComoA(app, COTACAO, cotacaoDeA({ itens: [{ ...item, ordemDeCompra: "151220" }] }))).statusCode).toBe(400);
  });

  it("salvar de novo com o mesmo id atualiza a cotação, sem duplicar, e troca os itens", async () => {
    const app = criarAppDeTeste();
    await salvarComoA(app, COTACAO, cotacaoDeA());
    const segunda = await salvarComoA(app, COTACAO, cotacaoDeA({ itens: [{ codigo: "P-200", quantidade: 7, precoCento: 130, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null }], entrega: "2027-01-15", observacao: "Entregar\nna portaria" }));
    expect(segunda.statusCode, segunda.body).toBe(200);
    expect(segunda.json()).toMatchObject({ itens: [{ codigo: "P-200", quantidade: 7, precoCento: 130, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null }], entrega: "2027-01-15", observacao: "Entregar\nna portaria", totalEstimado: 9.1 });
    expect((await comoA(app, "/api/pedidos")).json<PainelDePedidos>().cotacoes).toHaveLength(1);
  });

  it("guarda os dados do pedido escolhidos, com a transportadora do ERP ou uma nova", async () => {
    const app = criarAppDeTeste();
    const escolhas = { condicaoDePagamento: "1030", classificacao: "industrializacao", pedidoDoCliente: "OC 4512", aceitaParcial: true, clienteXped: true, transportadora: { codigo: "101" } };
    expect((await salvarComoA(app, COTACAO, cotacaoDeA({ escolhas }))).json<Cotacao>().escolhas).toEqual(escolhas);
    const nova = { ...escolhas, transportadora: { nova: { cnpj: "11222333000181", nome: "Nova Log", cidade: "Maringá", uf: "PR" } } };
    await salvarComoA(app, COTACAO, cotacaoDeA({ escolhas: nova }));
    expect((await comoA(app, `/api/cotacoes/${COTACAO}`)).json<Cotacao>().escolhas).toEqual(nova);
  });

  it("aceita a cotação sem os dados do pedido, da tela aberta antes deles", async () => {
    const resposta = await salvarComoA(criarAppDeTeste(), COTACAO, cotacaoDeA());
    expect(resposta.json<Cotacao>().escolhas).toBeNull();
  });

  it("recusa dados do pedido com campo a mais, classificação desconhecida ou CNPJ fora do formato", async () => {
    const app = criarAppDeTeste();
    const base = { condicaoDePagamento: "1030", classificacao: "comercializacao", pedidoDoCliente: "", aceitaParcial: false, clienteXped: false, transportadora: null };
    for (const escolhas of [
      { ...base, representante: "1402" },
      { ...base, classificacao: "revenda" },
      { ...base, transportadora: { nova: { cnpj: "11.222.333/0001-81", nome: "X Log", cidade: "Maringá", uf: "PR" } } },
      { ...base, transportadora: { codigo: "101", nova: { cnpj: "11222333000181", nome: "X Log", cidade: "Maringá", uf: "PR" } } },
    ]) {
      expect((await salvarComoA(app, COTACAO, cotacaoDeA({ escolhas }))).statusCode, JSON.stringify(escolhas)).toBe(400);
    }
  });

  it("guarda a cotação no app.db: outro servidor, no mesmo banco, a encontra", async () => {
    await salvarComoA(criarAppDeTeste(), COTACAO, cotacaoDeA());
    expect((await comoA(criarAppDeTeste(), `/api/cotacoes/${COTACAO}`)).statusCode).toBe(200);
  });

  it("descarta a cotação; depois dela, 404", async () => {
    const app = criarAppDeTeste();
    await salvarComoA(app, COTACAO, cotacaoDeA());
    const descarte = await app.inject({ method: "DELETE", url: `/api/cotacoes/${COTACAO}`, headers: { cookie: loginDeA, origin: ORIGEM } });
    expect(descarte.statusCode).toBe(204);
    expect((await comoA(app, `/api/cotacoes/${COTACAO}`)).statusCode).toBe(404);
    expect((await comoA(app, "/api/pedidos")).json<PainelDePedidos>().cotacoes).toEqual([]);
  });

  it("recusa o produto fora do catálogo, o preço abaixo da tabela, o produto repetido e a data que não existe", async () => {
    const app = criarAppDeTeste();
    const casos: [object, RegExp][] = [
      [{ itens: [{ codigo: "PRODUTO-SO-DE-B", quantidade: 10, precoCento: 90, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null }] }, /não está no catálogo/],
      [{ itens: [{ codigo: "F-100", quantidade: 10, precoCento: 95.49, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null }] }, /abaixo da tabela do cliente/],
      [{ itens: [{ codigo: "F-100", quantidade: 10, precoCento: 96, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null }, { codigo: "F-100", quantidade: 20, precoCento: 96, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null }] }, /duas vezes/],
      [{ entrega: "2027-02-30" }, /não existe/],
    ];
    for (const [parcial, erro] of casos) {
      const resposta = await salvarComoA(app, COTACAO, cotacaoDeA(parcial));
      expect(resposta.statusCode, JSON.stringify(parcial)).toBe(400);
      expect(resposta.json().erro).toMatch(erro);
    }
  });

  it("aceita o preço igual à tabela, que é o mínimo", async () => {
    const resposta = await salvarComoA(criarAppDeTeste(), COTACAO, cotacaoDeA({ itens: [{ codigo: "F-100", quantidade: 100, precoCento: 95.5, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null }] }));
    expect(resposta.statusCode, resposta.body).toBe(200);
  });

  it("não cria cotação vazia, mas deixa esvaziar a que já existe", async () => {
    const app = criarAppDeTeste();
    expect((await salvarComoA(app, COTACAO, cotacaoDeA({ itens: [] }))).statusCode).toBe(400);
    await salvarComoA(app, COTACAO, cotacaoDeA());
    expect((await salvarComoA(app, COTACAO, cotacaoDeA({ itens: [] }))).statusCode).toBe(200);
  });

  it("recusa o cliente de B e o grupo (404) e o cliente inativo (409, com o aviso)", async () => {
    const app = criarAppDeTeste();
    expect((await salvarComoA(app, COTACAO, cotacaoDeA({ codigoCliente: CLIENTE_DE_B }))).statusCode).toBe(404);
    expect((await salvarComoA(app, COTACAO, cotacaoDeA({ codigoCliente: GRUPO_DE_A }))).statusCode).toBe(404);
    const inativo = await salvarComoA(app, COTACAO, cotacaoDeA({ codigoCliente: CLIENTE_INATIVO_DE_A }));
    expect(inativo.statusCode).toBe(409);
    expect(inativo.json().erro).toMatch(/inativo no cadastro/);
  });

  it("não deixa fazer pedido para o cliente sem tabela de preço principal, e diz por quê (409)", async () => {
    const app = criarAppDeTeste();
    const catalogo = await comoA(app, `/api/clientes/${CLIENTE_SEM_TABELA_DE_A}/catalogo`);
    expect(catalogo.statusCode).toBe(409);
    expect(catalogo.json().erro).toBe(AVISO_DE_SEM_TABELA);
    const cotacao = await salvarComoA(app, COTACAO, cotacaoDeA({ codigoCliente: CLIENTE_SEM_TABELA_DE_A }));
    expect(cotacao.statusCode).toBe(409);
    expect(cotacao.json().erro).toBe(AVISO_DE_SEM_TABELA);
  });

  it("não deixa A ler, salvar por cima nem descartar a cotação de B", async () => {
    const app = criarAppDeTeste();
    const deB = await criarCotacaoDeB(app);
    expect((await comoA(app, `/api/cotacoes/${deB}`)).statusCode).toBe(404);
    expect((await salvarComoA(app, deB, cotacaoDeA())).statusCode).toBe(404);
    const descarte = await app.inject({ method: "DELETE", url: `/api/cotacoes/${deB}`, headers: { cookie: loginDeA, origin: ORIGEM } });
    expect(descarte.statusCode).toBe(404);
    expect((await comoA(app, "/api/pedidos")).json<PainelDePedidos>().cotacoes).toEqual([]);
  });

  it("recusa o campo a mais, o preço zerado, o id fora do formato e a observação com caractere de controle", async () => {
    const app = criarAppDeTeste();
    expect((await salvarComoA(app, COTACAO, { ...cotacaoDeA(), representante: "9999" })).statusCode).toBe(400);
    expect((await salvarComoA(app, COTACAO, cotacaoDeA({ itens: [{ codigo: "F-100", quantidade: 10, precoCento: 0, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null }] }))).statusCode).toBe(400);
    expect((await salvarComoA(app, "R1", cotacaoDeA())).statusCode).toBe(400);
    expect((await salvarComoA(app, COTACAO, cotacaoDeA({ observacao: "a\u0000b" }))).statusCode).toBe(400);
  });

  it("recusa a cotação pedida de outra origem", async () => {
    expect((await salvarComoA(criarAppDeTeste(), COTACAO, cotacaoDeA(), "https://outro.exemplo")).statusCode).toBe(403);
  });

  it("registra na auditoria a criação e o descarte, com o id do cliente, e não cada salvamento", async () => {
    const app = criarAppDeTeste();
    await salvarComoA(app, COTACAO, cotacaoDeA());
    await salvarComoA(app, COTACAO, cotacaoDeA({ observacao: "outra" }));
    await app.inject({ method: "DELETE", url: `/api/cotacoes/${COTACAO}`, headers: { cookie: loginDeA, origin: ORIGEM } });
    const eventos = banco.prepare("SELECT evento, alvo FROM auditoria WHERE evento LIKE 'cotacao_%' ORDER BY id").all();
    expect(eventos.map((linha) => ({ ...linha }))).toEqual([
      { evento: "cotacao_criada", alvo: CLIENTE_DE_A },
      { evento: "cotacao_descartada", alvo: CLIENTE_DE_A },
    ]);
  });
});
