import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { oracleDeTeste } from "../oracleDeTeste.ts";
import { lerAndamentoDosPedidosDoCrm, lerPedidosNaLan } from "./andamento.ts";

let pasta: string;

beforeEach(() => {
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), "crm-andamento-"));
  for (const sub of ["recebidos", "gravados", "quarentena"]) fs.mkdirSync(path.join(pasta, sub));
});

afterEach(() => {
  fs.rmSync(pasta, { recursive: true, force: true });
});

function receber(numero: string): void {
  fs.writeFileSync(path.join(pasta, "recebidos", `${numero}.json`), "{}");
}

function gravar(numero: string, numeroSgi: number): void {
  fs.writeFileSync(path.join(pasta, "gravados", `${numero}.sgi.json`), JSON.stringify({ numeroSgi, gravadoEm: "2026-11-23T19:10:08.000Z" }));
  fs.writeFileSync(path.join(pasta, "gravados", `${numero}.erp.json`), JSON.stringify({ empresa: 1, cliente: 123456 }));
}

describe("lerPedidosNaLan", () => {
  it("diz de cada recebido se está gravado, recusado ou só recebido", () => {
    receber("CRM-00001");
    receber("CRM-00002");
    receber("CRM-00003");
    gravar("CRM-00001", 1149872);
    fs.writeFileSync(path.join(pasta, "quarentena", "CRM-00002.motivo.txt"), "o cliente está inativo no cadastro do SGI\n");
    const porNumero = new Map(lerPedidosNaLan(pasta, Date.now()).map((pedido) => [pedido.numero, pedido]));
    expect(porNumero.get("CRM-00001")).toMatchObject({ situacao: "gravado", numeroSgi: 1149872, cliente: 123456, gravadoEm: "2026-11-23T16:10" });
    expect(porNumero.get("CRM-00002")).toMatchObject({ situacao: "recusado", motivo: "o cliente está inativo no cadastro do SGI" });
    expect(porNumero.get("CRM-00003")).toMatchObject({ situacao: "recebido" });
  });

  it("troca o erro técnico da gravação por um aviso ao representante", () => {
    receber("CRM-00004");
    fs.writeFileSync(path.join(pasta, "quarentena", "CRM-00004.motivo.txt"), "na gravação no SGI: ORA-20028: pedido do mesmo cliente\n");
    expect(lerPedidosNaLan(pasta, Date.now())[0]).toMatchObject({ situacao: "recusado", motivo: expect.stringMatching(/^O SGI não aceitou o pedido/) });
  });

  it("deixa de fora o pedido recebido há mais de 180 dias", () => {
    receber("CRM-00005");
    expect(lerPedidosNaLan(pasta, Date.now() + 181 * 24 * 60 * 60_000)).toEqual([]);
  });
});

describe("lerAndamentoDosPedidosDoCrm", () => {
  it("lê no SGI o status e o total dos gravados, pelo número e pelo cliente", async () => {
    receber("CRM-00001");
    gravar("CRM-00001", 1149872);
    const oracle = oracleDeTeste({ consultar: () => [[1149872, "PEDIDO BLOQUEADO", 295.2]] });
    expect(await lerAndamentoDosPedidosDoCrm(oracle, pasta)).toEqual([
      expect.objectContaining({ numero: "CRM-00001", situacao: "gravado", statusNoSgi: "PEDIDO BLOQUEADO", totalNoSgi: 295.2 }),
    ]);
    expect(oracle.chamadas[0]).toMatchObject({ tipo: "consulta", binds: { n0: 1149872, c0: 123456 } });
  });
});
