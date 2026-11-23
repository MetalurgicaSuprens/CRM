import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PedidoEnviado, PainelDePedidos } from "../../../web/src/dados/tipos.ts";
import { criarApp } from "../app.ts";
import { abrirBancoDoApp } from "../bancoDoApp.ts";
import { criarFotoAtual, type FotoAtual } from "../foto/fotoAtual.ts";
import { CLIENTE_DE_A, gravarFotoDeTeste, type PastasDeTeste } from "../fotoDeTeste.ts";
import { criarAutenticadorDeTeste, type AutenticadorDeTeste } from "../login/autenticadorDeTeste.ts";
import { criarConvite } from "../login/convites.ts";
import { criarUsuario } from "../login/usuarios.ts";
import type { PedidoParaOErp } from "./caixaDeSaida.ts";

const ORIGEM = "http://localhost:5175";
const COTACAO = "3f1c2b8e-5d4a-4c6b-9e7f-0a1b2c3d4e5f";
const OUTRO_COTACAO = "7c6d5e4f-3a2b-4c1d-8e9f-0a1b2c3d4e5f";
const ESCOLHAS = { condicaoDePagamento: "1030", classificacao: "industrializacao", pedidoDoCliente: "OC 4512", aceitaParcial: true, clienteXped: false, transportadora: { codigo: "101" } };

let pastas: PastasDeTeste;
let foto: FotoAtual;
let banco: DatabaseSync;
let saida: string;
let app: FastifyInstance;
/** Uma quarta-feira: a primeira entrega possível é a quarta seguinte, 2026-10-21. */
const agora = new Date("2026-10-14T12:00:00.000Z");

beforeAll(() => {
  pastas = gravarFotoDeTeste();
  foto = criarFotoAtual(pastas);
});

beforeEach(() => {
  banco = abrirBancoDoApp(":memory:");
  saida = fs.mkdtempSync(path.join(os.tmpdir(), "crm-saida-"));
  app = criarApp({ foto, banco, origem: ORIGEM, pastaDeSaida: saida, agora: () => agora });
});

afterEach(() => {
  fs.rmSync(saida, { recursive: true, force: true });
});

afterAll(() => {
  foto.fechar();
  fs.rmSync(pastas.raiz, { recursive: true, force: true });
});

type Representante = { cookie: string; aparelho: AutenticadorDeTeste };

/** Um representante com a chave criada pelo convite, como na vida real, e a sessão aberta. */
async function representante(codigos = ["1401"]): Promise<Representante> {
  const usuario = criarUsuario(banco, { nome: `Teste ${codigos.join(" e ")}`, codigos, autorizados: new Set(codigos), ligadoPor: "teste" }, agora);
  const { token } = criarConvite(banco, { usuario: usuario.id, criadoPor: "teste" }, agora);
  const aparelho = criarAutenticadorDeTeste();
  const opcoes = (await postar("/api/convite/opcoes", { token })).json();
  const resposta = await postar("/api/convite/chave", { token, resposta: aparelho.criar(opcoes, ORIGEM) });
  expect(resposta.statusCode, resposta.body).toBe(204);
  return { cookie: String(resposta.headers["set-cookie"]).split(";")[0] ?? "", aparelho };
}

function postar(url: string, corpo?: object, cookie?: string): Promise<LightMyRequestResponse> {
  return app.inject({ method: "POST", url, headers: { origin: ORIGEM, ...(cookie ? { cookie } : {}) }, ...(corpo ? { payload: corpo } : {}) });
}

function ler(url: string, cookie: string): Promise<LightMyRequestResponse> {
  return app.inject({ method: "GET", url, headers: { cookie } });
}

/** 300 peças do F-100 a 98,40 o cento, acima da tabela (95,50), com as condições escolhidas. */
async function salvarCotacao({ cookie }: Representante, parcial: object = {}, id = COTACAO): Promise<void> {
  const corpo = { codigoCliente: CLIENTE_DE_A, itens: [{ codigo: "F-100", quantidade: 300, precoCento: 98.4, ordemDeCompra: null, itemDaOrdemDeCompra: null }], entrega: null, observacao: "", escolhas: ESCOLHAS, ...parcial };
  const resposta = await app.inject({ method: "PUT", url: `/api/cotacoes/${id}`, headers: { cookie, origin: ORIGEM }, payload: corpo });
  expect(resposta.statusCode, resposta.body).toBe(200);
}

function pedirOpcoes({ cookie }: Representante, id = COTACAO): Promise<LightMyRequestResponse> {
  return postar(`/api/cotacoes/${id}/envio/opcoes`, undefined, cookie);
}

function confirmar({ cookie }: Representante, resposta: object, id = COTACAO): Promise<LightMyRequestResponse> {
  return postar(`/api/cotacoes/${id}/envio`, { resposta }, cookie);
}

/** Pede as opções e confirma com o aparelho do próprio representante. */
async function enviar(quem: Representante): Promise<LightMyRequestResponse> {
  const opcoes = await pedirOpcoes(quem);
  expect(opcoes.statusCode, opcoes.body).toBe(200);
  return confirmar(quem, quem.aparelho.usar(opcoes.json(), ORIGEM));
}

function arquivosNaSaida(): string[] {
  return fs.readdirSync(saida);
}

function eventos(evento: string): { alvo: string | null; resultado: string }[] {
  return banco.prepare("SELECT alvo, resultado FROM auditoria WHERE evento = ?").all(evento) as { alvo: string | null; resultado: string }[];
}

describe("envio do pedido", () => {
  it("confirma com a chave de acesso, dá o número do CRM, tira das cotações e põe na caixa de saída", async () => {
    const a = await representante();
    await salvarCotacao(a);
    const resposta = await enviar(a);
    expect(resposta.statusCode, resposta.body).toBe(200);
    const pedido = resposta.json<PedidoEnviado>();
    expect(pedido).toMatchObject({ numero: "CRM-00001", etapa: "enviado", totalEstimado: 295.2, cliente: { codigo: CLIENTE_DE_A } });
    expect(pedido.itens).toEqual([{ codigo: "F-100", quantidade: 300, precoCento: 98.4, ordemDeCompra: null, itemDaOrdemDeCompra: null, familia: "FLEXIL", medida: "14–22 mm" }]);

    const painel = (await ler("/api/pedidos", a.cookie)).json<PainelDePedidos>();
    expect(painel.cotacoes).toEqual([]);
    expect(painel.enviados.map(({ numero }) => numero)).toEqual(["CRM-00001"]);
    expect((await ler("/api/pedidos/enviados/CRM-00001", a.cookie)).json<PedidoEnviado>().numero).toBe("CRM-00001");
    expect(eventos("pedido_enviado")).toEqual([{ alvo: "CRM-00001", resultado: "ok" }]);
  });

  it("deixa na caixa de saída o pedido com os códigos da sessão e o id do cliente, sem nome de cliente", async () => {
    const a = await representante(["1401", "1402"]);
    await salvarCotacao(a, { observacao: "Entregar pela manhã" });
    await enviar(a);
    expect(arquivosNaSaida()).toEqual(["CRM-00001.json"]);
    const conteudo = fs.readFileSync(path.join(saida, "CRM-00001.json"), "utf8");
    expect(JSON.parse(conteudo) as PedidoParaOErp).toMatchObject({
      versao: 1,
      numero: "CRM-00001",
      codigos: ["1401", "1402"],
      cliente: CLIENTE_DE_A,
      itens: [{ codigo: "F-100", quantidade: 300, precoCento: 98.4, ordemDeCompra: null, itemDaOrdemDeCompra: null }],
      observacao: "Entregar pela manhã",
      escolhas: ESCOLHAS,
      hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(conteudo).not.toContain("CLIENTE DE A");
  });

  it("leva à caixa de saída a ordem de compra e o item dela de cada item", async () => {
    const a = await representante();
    const item = { codigo: "F-100", quantidade: 300, precoCento: 98.4, ordemDeCompra: "151220/ES", itemDaOrdemDeCompra: 3 };
    await salvarCotacao(a, { itens: [item] });
    await enviar(a);
    expect((JSON.parse(fs.readFileSync(path.join(saida, "CRM-00001.json"), "utf8")) as PedidoParaOErp).itens).toEqual([item]);
  });

  it("recusa a confirmação se a cotação mudou depois das opções, e nada sai", async () => {
    const a = await representante();
    await salvarCotacao(a);
    const opcoes = (await pedirOpcoes(a)).json();
    await salvarCotacao(a, { itens: [{ codigo: "F-100", quantidade: 30_000, precoCento: 98.4, ordemDeCompra: null, itemDaOrdemDeCompra: null }] });
    const resposta = await confirmar(a, a.aparelho.usar(opcoes, ORIGEM));
    expect(resposta.statusCode).toBe(400);
    expect(arquivosNaSaida()).toEqual([]);
    expect((await ler("/api/pedidos", a.cookie)).json<PainelDePedidos>().cotacoes).toHaveLength(1);
    expect(eventos("envio_recusado")).toHaveLength(1);
  });

  it("não aceita de novo uma confirmação já usada, nem para outra cotação igual", async () => {
    const a = await representante();
    await salvarCotacao(a);
    const assinatura = a.aparelho.usar((await pedirOpcoes(a)).json(), ORIGEM);
    expect((await confirmar(a, assinatura)).statusCode).toBe(200);
    await salvarCotacao(a, {}, OUTRO_COTACAO);
    expect((await pedirOpcoes(a, OUTRO_COTACAO)).statusCode).toBe(200);
    expect((await confirmar(a, assinatura, OUTRO_COTACAO)).statusCode).toBe(400);
    expect(arquivosNaSaida()).toEqual(["CRM-00001.json"]);
  });

  it("não aceita a chave de outro login, mesmo com as opções da cotação", async () => {
    const a = await representante();
    const outro = await representante(["1402"]);
    await salvarCotacao(a);
    const opcoes = (await pedirOpcoes(a)).json();
    expect((await confirmar(a, outro.aparelho.usar(opcoes, ORIGEM))).statusCode).toBe(400);
    expect(eventos("envio_recusado")).toEqual([{ alvo: COTACAO, resultado: "chave de outro login ou desconhecida" }]);
  });

  it.each([
    ["sem as condições do pedido", { escolhas: null }, "Faltam as condições do pedido."],
    ["sem transportadora", { escolhas: { ...ESCOLHAS, transportadora: null } }, "Escolha a transportadora."],
    ["com entrega antes de 5 dias úteis", { entrega: "2026-10-20" }, "A entrega desejada precisa ser a partir de 21/10/2026: 5 dias úteis depois de hoje."],
  ])("não pede a chave para a cotação %s", async (_caso, parcial, erro) => {
    const a = await representante();
    await salvarCotacao(a, parcial);
    const resposta = await pedirOpcoes(a);
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({ erro });
  });

  it("desfaz o envio se a caixa de saída falha: a cotação fica e nenhum número é gasto", async () => {
    const a = await representante();
    await salvarCotacao(a);
    const opcoes = (await pedirOpcoes(a)).json();
    fs.writeFileSync(path.join(saida, "CRM-00001.json"), "outro pedido");
    expect((await confirmar(a, a.aparelho.usar(opcoes, ORIGEM))).statusCode).toBe(500);
    expect(banco.prepare("SELECT COUNT(*) AS quantos FROM pedidos_enviados").get()?.quantos).toBe(0);
    expect((await ler("/api/pedidos", a.cookie)).json<PainelDePedidos>().cotacoes).toHaveLength(1);
    expect(fs.readFileSync(path.join(saida, "CRM-00001.json"), "utf8")).toBe("outro pedido");
  });

  it("não deixa o salvamento automático que chega depois do envio recriar a cotação", async () => {
    const a = await representante();
    await salvarCotacao(a);
    await enviar(a);
    const corpo = { codigoCliente: CLIENTE_DE_A, itens: [{ codigo: "F-100", quantidade: 300, precoCento: 98.4, ordemDeCompra: null, itemDaOrdemDeCompra: null }], entrega: null, observacao: "", escolhas: ESCOLHAS };
    const resposta = await app.inject({ method: "PUT", url: `/api/cotacoes/${COTACAO}`, headers: { cookie: a.cookie, origin: ORIGEM }, payload: corpo });
    expect(resposta.statusCode).toBe(409);
    expect((await ler("/api/pedidos", a.cookie)).json<PainelDePedidos>().cotacoes).toEqual([]);
  });

  it("guarda o pedido enviado sem deixar mudar", async () => {
    const a = await representante();
    await salvarCotacao(a);
    await enviar(a);
    expect(() => banco.prepare("UPDATE pedidos_enviados SET conteudo = '{}'").run()).toThrow(/não muda/);
  });
});

describe("envio desligado", () => {
  it("avisa que o envio ainda não foi liberado e mantém a cotação", async () => {
    app = criarApp({ foto, banco, origem: ORIGEM, pastaDeSaida: null, agora: () => agora });
    const a = await representante();
    await salvarCotacao(a);
    const resposta = await pedirOpcoes(a);
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json<{ erro: string }>().erro).toMatch(/ainda não foi liberado/);
    expect((await ler("/api/pedidos", a.cookie)).json<PainelDePedidos>().cotacoes).toHaveLength(1);
  });
});
