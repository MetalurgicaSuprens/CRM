import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PEDIDOS_POR_PASSADA, buscarPedidosNovos, planejarBusca } from "./buscarPedidos.ts";
import { abrirServidorSimulado, type ServidorSimulado } from "./servidorSimulado.ts";
import { APELIDO_DO_SERVIDOR, programaDoOpenSsh, type DestinoDoEnvio } from "./sftp.ts";

describe("planejarBusca", () => {
  it("traz com nome provisório só os pedidos que ainda não chegaram, em ordem de número", () => {
    const plano = planejarBusca(["CRM-00003.json", "CRM-00001.json", "CRM-00002.json"], ["CRM-00001.json"]);
    expect(plano).toEqual({
      novos: ["CRM-00002.json", "CRM-00003.json"],
      comandos: ["get /saida/CRM-00002.json CRM-00002.json.part", "get /saida/CRM-00003.json CRM-00003.json.part"],
      restantes: 0,
    });
  });

  it("ordena pelo número, e não pelo texto", () => {
    expect(planejarBusca(["CRM-100000.json", "CRM-99999.json"], []).novos).toEqual(["CRM-99999.json", "CRM-100000.json"]);
  });

  it("deixa para a próxima passada o que passa do teto", () => {
    const noServidor = Array.from({ length: PEDIDOS_POR_PASSADA + 3 }, (_, i) => `CRM-${String(i + 1).padStart(5, "0")}.json`);
    const plano = planejarBusca(noServidor, []);
    expect(plano.novos).toHaveLength(PEDIDOS_POR_PASSADA);
    expect(plano.restantes).toBe(3);
  });

  it("nunca leva aos comandos um nome fora do padrão nem o arquivo ainda sendo gravado", () => {
    const { comandos } = planejarBusca(["CRM-00001.json.part", "CRM-1.json", "../app.db", "CRM-00002.json !del", "x.json"], []);
    expect(comandos).toEqual([]);
  });
});

describe("buscarPedidosNovos, com o servidor simulado", { timeout: 60_000 }, () => {
  let pasta: string;
  let chaveDoExtrator: string;
  let servidor: ServidorSimulado;
  let saidaNoServidor: string;
  let recebidos: string;
  let destino: DestinoDoEnvio;

  beforeAll(() => {
    pasta = fs.mkdtempSync(path.join(os.tmpdir(), "crm-pedidos-"));
    chaveDoExtrator = path.join(pasta, "chave-do-extrator");
    const gerada = spawnSync(programaDoOpenSsh("ssh-keygen"), ["-q", "-t", "ed25519", "-N", "", "-C", "extrator", "-f", chaveDoExtrator]);
    if (gerada.status !== 0) throw new Error(`ssh-keygen falhou: ${String(gerada.stderr)}`);
  });

  afterAll(() => {
    fs.rmSync(pasta, { recursive: true, force: true });
  });

  beforeEach(async () => {
    const raiz = fs.mkdtempSync(path.join(pasta, "servidor-"));
    saidaNoServidor = path.join(raiz, "saida");
    fs.mkdirSync(saidaNoServidor);
    recebidos = path.join(fs.mkdtempSync(path.join(pasta, "dados-")), "pedidos", "recebidos");
    servidor = await abrirServidorSimulado({ raiz, usuario: "crm-troca", chaveAutorizada: fs.readFileSync(`${chaveDoExtrator}.pub`, "utf8") });
    const servidorConhecido = path.join(pasta, `servidor-conhecido-${servidor.porta}`);
    fs.writeFileSync(servidorConhecido, `${APELIDO_DO_SERVIDOR} ${servidor.chavePublica}\n`);
    destino = { endereco: "127.0.0.1", porta: servidor.porta, usuario: "crm-troca", chave: chaveDoExtrator, servidorConhecido };
  });

  afterEach(async () => {
    await servidor.fechar();
  });

  function pedidoNoServidor(numero: string): string {
    const conteudo = JSON.stringify({ versao: 1, numero, itens: [] });
    fs.writeFileSync(path.join(saidaNoServidor, `${numero}.json`), conteudo);
    return conteudo;
  }

  it("traz os pedidos inteiros, com o nome do pedido, e não apaga nada no servidor", async () => {
    const primeiro = pedidoNoServidor("CRM-00001");
    pedidoNoServidor("CRM-00002");

    expect(await buscarPedidosNovos(recebidos, destino)).toEqual({ recebidos: ["CRM-00001.json", "CRM-00002.json"], restantes: 0 });
    expect(fs.readdirSync(recebidos).sort()).toEqual(["CRM-00001.json", "CRM-00002.json"]);
    expect(fs.readFileSync(path.join(recebidos, "CRM-00001.json"), "utf8")).toBe(primeiro);
    expect(fs.readdirSync(saidaNoServidor).sort()).toEqual(["CRM-00001.json", "CRM-00002.json"]);
    expect(servidor.operacoes).toEqual([]);
  });

  it("na passada seguinte, traz só o pedido novo", async () => {
    pedidoNoServidor("CRM-00001");
    await buscarPedidosNovos(recebidos, destino);
    pedidoNoServidor("CRM-00002");

    expect((await buscarPedidosNovos(recebidos, destino)).recebidos).toEqual(["CRM-00002.json"]);
  });

  it("com a caixa de saída vazia, não traz nada", async () => {
    expect(await buscarPedidosNovos(recebidos, destino)).toEqual({ recebidos: [], restantes: 0 });
  });

  it("não traz nada do servidor que mostra outra chave", async () => {
    pedidoNoServidor("CRM-00001");
    const servidorConhecido = path.join(pasta, "impostor");
    fs.writeFileSync(servidorConhecido, `${APELIDO_DO_SERVIDOR} ssh-ed25519 ${"A".repeat(68)}\n`);

    await expect(buscarPedidosNovos(recebidos, { ...destino, servidorConhecido })).rejects.toThrow(/não mostrou a chave conhecida/);
    expect(fs.readdirSync(recebidos)).toEqual([]);
  });
});
