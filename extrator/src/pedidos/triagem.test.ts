import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Decisao } from "./conferencia.ts";
import type { PedidoRecebido } from "./formato.ts";
import { pedidoDeTeste } from "./pedidoDeTeste.ts";
import { ARQUIVO_PARA_PAUSAR, PEDIDOS_POR_LOGIN_POR_DIA, pedidosParaTriar, triarRecebidos } from "./triagem.ts";

const ERP = { empresa: 1, cliente: 123456, vendedor: "1401", tabela: "PDR02", condicaoDePagamento: "1030", transportadora: "101" };

let pasta: string;

beforeEach(() => {
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), "crm-triagem-"));
  fs.mkdirSync(path.join(pasta, "recebidos"));
});

afterEach(() => {
  fs.rmSync(pasta, { recursive: true, force: true });
});

function numeroCrm(numero: number): string {
  return `CRM-${String(numero).padStart(5, "0")}`;
}

function receber(numero: number, parcial: Partial<PedidoRecebido> = {}): void {
  const pedido = pedidoDeTeste({ numero: numeroCrm(numero), ...parcial });
  fs.writeFileSync(path.join(pasta, "recebidos", `${pedido.numero}.json`), JSON.stringify(pedido));
}

function em(destino: string): string[] {
  const caminho = path.join(pasta, destino);
  return fs.existsSync(caminho) ? fs.readdirSync(caminho).sort() : [];
}

/** Uma conferência que decide sempre igual e conta as chamadas. */
function conferindo(decisao: Decisao) {
  const conferidos: string[] = [];
  return {
    conferidos,
    conferir: (pedido: PedidoRecebido) => {
      conferidos.push(pedido.numero);
      return Promise.resolve(decisao);
    },
  };
}

describe("triarRecebidos", () => {
  it("leva o pedido conferido, com o que só a LAN sabe ao lado, e deixa o recebido como veio", async () => {
    receber(1);
    const original = fs.readFileSync(path.join(pasta, "recebidos", "CRM-00001.json"), "utf8");
    const resumo = await triarRecebidos(pasta, conferindo({ destino: "conferidos", erp: ERP }).conferir);
    expect(resumo.porDestino.conferidos).toEqual(["CRM-00001"]);
    expect(em("conferidos")).toEqual(["CRM-00001.erp.json", "CRM-00001.json"]);
    expect(JSON.parse(fs.readFileSync(path.join(pasta, "conferidos", "CRM-00001.erp.json"), "utf8"))).toEqual(ERP);
    expect(fs.readFileSync(path.join(pasta, "recebidos", "CRM-00001.json"), "utf8")).toBe(original);
  });

  it("não confere de novo o que já teve destino", async () => {
    receber(1);
    await triarRecebidos(pasta, conferindo({ destino: "quarentena", motivo: "teste" }).conferir);
    const segunda = conferindo({ destino: "conferidos", erp: ERP });
    await triarRecebidos(pasta, segunda.conferir);
    expect(segunda.conferidos).toEqual([]);
    expect(pedidosParaTriar(pasta)).toEqual([]);
  });

  it("põe em quarentena o arquivo fora do formato, com o motivo, sem chegar ao Oracle", async () => {
    fs.writeFileSync(path.join(pasta, "recebidos", "CRM-00001.json"), "{ não é json");
    const conferencia = conferindo({ destino: "conferidos", erp: ERP });
    await triarRecebidos(pasta, conferencia.conferir);
    expect(conferencia.conferidos).toEqual([]);
    expect(fs.readFileSync(path.join(pasta, "quarentena", "CRM-00001.motivo.txt"), "utf8")).toBe("o arquivo não é JSON\n");
  });

  it("confere de novo a cada passada o que aguarda a transportadora, e tira de lá quando ela aparece", async () => {
    receber(1);
    await triarRecebidos(pasta, conferindo({ destino: "aguardando", motivo: "espera vendas" }).conferir);
    expect(em("aguardando")).toEqual(["CRM-00001.json", "CRM-00001.motivo.txt"]);
    await triarRecebidos(pasta, conferindo({ destino: "conferidos", erp: ERP }).conferir);
    expect(em("aguardando")).toEqual([]);
    expect(em("conferidos")).toContain("CRM-00001.json");
  });

  it("não confere nada com o arquivo PAUSAR", async () => {
    receber(1);
    fs.writeFileSync(path.join(pasta, ARQUIVO_PARA_PAUSAR), "");
    const conferencia = conferindo({ destino: "conferidos", erp: ERP });
    expect((await triarRecebidos(pasta, conferencia.conferir)).isPausada).toBe(true);
    expect(conferencia.conferidos).toEqual([]);
  });

  it("aceita no máximo o teto de pedidos por login no dia do envio, mesmo em passadas diferentes", async () => {
    for (let numero = 1; numero <= PEDIDOS_POR_LOGIN_POR_DIA; numero++) receber(numero);
    await triarRecebidos(pasta, conferindo({ destino: "conferidos", erp: ERP }).conferir);
    receber(PEDIDOS_POR_LOGIN_POR_DIA + 1);
    receber(PEDIDOS_POR_LOGIN_POR_DIA + 2, { enviadoEm: "2026-11-19T08:00" });
    const resumo = await triarRecebidos(pasta, conferindo({ destino: "conferidos", erp: ERP }).conferir);
    expect(resumo.porDestino.quarentena).toEqual([numeroCrm(PEDIDOS_POR_LOGIN_POR_DIA + 1)]);
    expect(resumo.porDestino.conferidos).toEqual([numeroCrm(PEDIDOS_POR_LOGIN_POR_DIA + 2)]);
  });

  it("confere em ordem de número", async () => {
    receber(10);
    receber(9);
    const conferencia = conferindo({ destino: "conferidos", erp: ERP });
    await triarRecebidos(pasta, conferencia.conferir);
    expect(conferencia.conferidos).toEqual(["CRM-00009", "CRM-00010"]);
  });
});
