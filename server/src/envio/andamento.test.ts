import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Foto } from "dominio/esquemaDaFoto";
import type { FichaCliente, PedidoEnviado } from "../../../web/src/dados/tipos.ts";
import { criarApp } from "../app.ts";
import { abrirBancoDoApp } from "../bancoDoApp.ts";
import { criarFotoAtual, type FotoAtual } from "../foto/fotoAtual.ts";
import { CLIENTE_DE_A, gravarFotoDeTeste, montarFotoDeTeste, type PastasDeTeste } from "../fotoDeTeste.ts";
import { entrarComo } from "../login/loginDeTeste.ts";
import { limparCaixaDeSaida } from "./caixaDeSaida.ts";

/*
 * O andamento dos pedidos enviados, que a máquina do extrator manda na foto (pedido_crm, F5 etapa 5).
 * Os pedidos de A entram direto no app.db; o envio em si está em envio.test.ts.
 */

const ORIGEM = "http://localhost:5175";

/** CRM-00001 está no SGI esperando a liberação; CRM-00002 chegou ao Omega; CRM-00003 foi recusado. */
const PEDIDOS_DO_CRM: Foto["pedido_crm"] = [
  {
    numero: "CRM-00001",
    etapa: "em_aprovacao",
    numero_sgi: "1149872",
    numero_erp: null,
    total_sgi: 295.2,
    motivo_recusa: null,
    historico: JSON.stringify([
      { etapa: "recebido", em: "2026-11-23T16:10" },
      { etapa: "em_aprovacao", em: "2026-11-23T16:10" },
    ]),
  },
  { numero: "CRM-00002", etapa: "no_erp", numero_sgi: "1149873", numero_erp: "1149873", total_sgi: 100, motivo_recusa: null, historico: "[]" },
  { numero: "CRM-00003", etapa: "recusado", numero_sgi: null, numero_erp: null, total_sgi: null, motivo_recusa: "o cliente está inativo no cadastro do SGI", historico: "[]" },
];

let pastas: PastasDeTeste;
let foto: FotoAtual;
let banco: DatabaseSync;
let app: FastifyInstance;
let loginDeA: string;

beforeAll(() => {
  pastas = gravarFotoDeTeste({ ...montarFotoDeTeste(), pedido_crm: PEDIDOS_DO_CRM });
  foto = criarFotoAtual(pastas);
});

beforeEach(() => {
  banco = abrirBancoDoApp(":memory:");
  loginDeA = entrarComo(banco, ["1401"]);
  app = criarApp({ foto, banco, origem: ORIGEM });
  const usuario = String(banco.prepare("SELECT usuario FROM usuario_codigos WHERE codigo = '1401'").get()?.usuario);
  const conteudo = JSON.stringify({ cliente: CLIENTE_DE_A, itens: [{ codigo: "F-100", quantidade: 300, precoCento: 98.4, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null }], entrega: null, observacao: "", escolhas: null });
  const inserir = banco.prepare("INSERT INTO pedidos_enviados (usuario, cliente, cotacao, conteudo, hash, chave, assinatura, enviado_em) VALUES (?, ?, ?, ?, '', ?, '{}', ?)");
  for (const [i, cotacao] of ["0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d41", "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d42", "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d43", "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d44"].entries()) {
    inserir.run(usuario, CLIENTE_DE_A, cotacao, conteudo, `chave-de-${usuario}`, `2026-11-23T16:0${i}`);
  }
});

afterAll(() => {
  foto.fechar();
  fs.rmSync(pastas.raiz, { recursive: true, force: true });
});

async function pedido(numero: string): Promise<PedidoEnviado> {
  return (await app.inject({ method: "GET", url: `/api/pedidos/enviados/${numero}`, headers: { cookie: loginDeA } })).json<PedidoEnviado>();
}

describe("andamento do pedido enviado", () => {
  it("mostra a etapa, o número e o total do SGI que vieram da foto, depois do envio", async () => {
    expect(await pedido("CRM-00001")).toMatchObject({
      etapa: "em_aprovacao",
      numeroSgi: "1149872",
      totalSgi: 295.2,
      historico: [
        { etapa: "enviado", em: "2026-11-23T16:00" },
        { etapa: "recebido", em: "2026-11-23T16:10" },
        { etapa: "em_aprovacao", em: "2026-11-23T16:10" },
      ],
    });
  });

  it("mostra o motivo da recusa", async () => {
    expect(await pedido("CRM-00003")).toMatchObject({ etapa: "recusado", motivoRecusa: "o cliente está inativo no cadastro do SGI" });
  });

  it("sem linha na foto, o pedido só foi enviado", async () => {
    expect(await pedido("CRM-00004")).toMatchObject({ etapa: "enviado", numeroSgi: null, historico: [{ etapa: "enviado", em: "2026-11-23T16:03" }] });
  });

  it("na ficha, só os pedidos que ainda não chegaram ao ERP nem foram recusados", async () => {
    const ficha = (await app.inject({ method: "GET", url: `/api/clientes/${CLIENTE_DE_A}`, headers: { cookie: loginDeA } })).json<FichaCliente>();
    const doCrm = ficha.pedidos.filter(({ numero }) => numero?.startsWith("CRM-")).map(({ numero }) => numero);
    expect(doCrm.sort()).toEqual(["CRM-00001", "CRM-00004"]);
  });
});

describe("limparCaixaDeSaida", () => {
  it("apaga da caixa de saída só os pedidos que a foto mostra recebidos pela LAN", () => {
    const saida = fs.mkdtempSync(path.join(os.tmpdir(), "crm-saida-"));
    for (const nome of ["CRM-00001.json", "CRM-00004.json", "CRM-00005.json.part"]) fs.writeFileSync(path.join(saida, nome), "{}");
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE pedido_crm (numero TEXT); INSERT INTO pedido_crm VALUES ('CRM-00001'), ('CRM-00002');");
    expect(limparCaixaDeSaida(saida, db)).toBe(1);
    expect(fs.readdirSync(saida).sort()).toEqual(["CRM-00004.json", "CRM-00005.json.part"]);
    fs.rmSync(saida, { recursive: true, force: true });
  });
});
