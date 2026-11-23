import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Linha } from "../oracle.ts";
import { oracleDeTeste, type RespostasDoOracle } from "../oracleDeTeste.ts";
import type { PedidoNoErp } from "./conferencia.ts";
import { TENTATIVAS_ANTES_DA_QUARENTENA, gravarConferidos, pedidosParaGravar } from "./gravacao.ts";
import { pedidoDeTeste } from "./pedidoDeTeste.ts";
import { pedidosParaTriar } from "./triagem.ts";

const ERP: PedidoNoErp = { empresa: 1, cliente: 123456, vendedor: "1401", tabela: "PDR02", condicaoDePagamento: "1030", transportadora: "101" };
/** A linha do cadastro, na ordem do SELECT de lerCadastroDoPedido. */
const CADASTRO: Linha = [5101, 1, 310, "PDR02", "REAL", "SIM", "SIM", 18, 1401, 5, 3, 341, 1, 7, 2];
/** A linha do produto, na ordem do SELECT de lerProdutosDoPedido. */
const PRODUTO: Linha = ["F-100", "CF420118", "PNF-1", 0, 5, "10+5", 0.855, 111.7, 95.5, "PRACA"];

let pasta: string;

beforeEach(() => {
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), "crm-gravacao-"));
  fs.mkdirSync(path.join(pasta, "conferidos"));
  fs.mkdirSync(path.join(pasta, "recebidos"));
  const pedido = JSON.stringify(pedidoDeTeste());
  fs.writeFileSync(path.join(pasta, "recebidos", "CRM-00001.json"), pedido);
  fs.writeFileSync(path.join(pasta, "conferidos", "CRM-00001.json"), pedido);
  fs.writeFileSync(path.join(pasta, "conferidos", "CRM-00001.erp.json"), JSON.stringify(ERP));
});

afterEach(() => {
  fs.rmSync(pasta, { recursive: true, force: true });
});

/** O ERP de um cliente com tabela PRINCIPAL e o F-100 nela; o maior número de pedido do SGI é 1000. */
function oracleDoErp({ maioresNumeros = [1000], pedidoNoSgi = false, cadastro = [CADASTRO], executar }: { maioresNumeros?: number[]; pedidoNoSgi?: boolean; cadastro?: Linha[] } & Pick<RespostasDoOracle, "executar"> = {}) {
  const numeros = [...maioresNumeros];
  return oracleDeTeste({
    executar,
    consultar: (sql) => {
      if (sql.includes("SGI5_TAB_VEN_CLI B")) return cadastro;
      if (sql.includes("VIEW_IPR")) return [PRODUTO];
      if (sql.includes("MAX(NVL(A.PV1_NPE")) return [[numeros.length > 1 ? numeros.shift() : numeros[0]]];
      if (sql.includes("COUNT(*)")) return [[pedidoNoSgi ? 1 : 0]];
      if (sql.includes("'YYYY-MM-DD') FROM DUAL")) return [["2026-11-23"]];
      return [];
    },
  });
}

function execucoes(oracle: ReturnType<typeof oracleDeTeste>) {
  return oracle.chamadas.filter((chamada) => chamada.tipo === "execucao");
}

function em(destino: string): string[] {
  const caminho = path.join(pasta, destino);
  return fs.existsSync(caminho) ? fs.readdirSync(caminho).sort() : [];
}

describe("gravarConferidos", () => {
  it("grava o cabeçalho, o item e a efetivação numa transação e leva o pedido para gravados, com o número do SGI", async () => {
    const oracle = oracleDoErp();
    expect(await gravarConferidos(pasta, oracle)).toEqual({ gravados: [{ pedido: "CRM-00001", numeroNoSgi: 1001 }], adiados: [], quarentena: [] });
    expect(execucoes(oracle)).toHaveLength(3);
    expect(oracle.chamadas.filter(({ tipo }) => tipo === "confirmar")).toHaveLength(1);
    expect(em("conferidos")).toEqual([]);
    expect(em("gravados")).toEqual(["CRM-00001.erp.json", "CRM-00001.json", "CRM-00001.sgi.json"]);
    expect(JSON.parse(fs.readFileSync(path.join(pasta, "gravados", "CRM-00001.sgi.json"), "utf8"))).toMatchObject({ numeroNoSgi: 1001 });
    expect(em("andamento")).toEqual([]);
  });

  it("o gravado não volta para a conferência nem para a gravação", async () => {
    await gravarConferidos(pasta, oracleDoErp());
    expect(pedidosParaTriar(pasta)).toEqual([]);
    expect(pedidosParaGravar(pasta)).toEqual([]);
  });

  it("com o número já usado pela tela do SGI, desfaz e grava com o seguinte", async () => {
    let primeira = true;
    const oracle = oracleDoErp({
      maioresNumeros: [1000, 1001],
      executar: () => {
        if (!primeira) return;
        primeira = false;
        throw new Error("ORA-00001: unique constraint (ABC71.PK_SGI5_TAB_VEN_PV1_V2) violated");
      },
    });
    expect((await gravarConferidos(pasta, oracle)).gravados).toEqual([{ pedido: "CRM-00001", numeroNoSgi: 1002 }]);
    expect(oracle.chamadas.filter(({ tipo }) => tipo === "desfazer")).toHaveLength(1);
  });

  it("quando o SGI recusa, desfaz e tenta nas passadas seguintes; na sexta, põe em quarentena com o motivo", async () => {
    const recusa = () => {
      throw new Error("ORA-20028: pedido do mesmo cliente com menos de 4 minutos");
    };
    for (let passada = 1; passada < TENTATIVAS_ANTES_DA_QUARENTENA; passada++) {
      expect((await gravarConferidos(pasta, oracleDoErp({ executar: recusa }))).adiados).toHaveLength(1);
    }
    expect((await gravarConferidos(pasta, oracleDoErp({ executar: recusa }))).quarentena).toEqual([{ pedido: "CRM-00001", motivo: expect.stringMatching(/ORA-20028/) }]);
    expect(em("quarentena")).toEqual(["CRM-00001.json", "CRM-00001.motivo.txt"]);
    expect(em("conferidos")).toEqual([]);
    expect(pedidosParaTriar(pasta)).toEqual([]);
  });

  it("com a conexão caída, para a passada e deixa o pedido para a próxima", async () => {
    const oracle = oracleDoErp({
      executar: () => {
        throw new Error("NJS-500: connection to the Oracle Database was broken");
      },
    });
    await expect(gravarConferidos(pasta, oracle)).rejects.toThrow(/NJS-500/);
    expect(em("conferidos")).toEqual(["CRM-00001.erp.json", "CRM-00001.json"]);
  });

  it("não grava de novo o pedido que entrou no SGI numa passada que caiu depois de confirmar", async () => {
    fs.mkdirSync(path.join(pasta, "andamento"));
    fs.writeFileSync(path.join(pasta, "andamento", "CRM-00001.json"), JSON.stringify({ tentativas: 0, ultimoErro: null, numeroEmGravacao: 1001 }));
    const oracle = oracleDoErp({ pedidoNoSgi: true });
    expect((await gravarConferidos(pasta, oracle)).gravados).toEqual([{ pedido: "CRM-00001", numeroNoSgi: 1001 }]);
    expect(execucoes(oracle)).toEqual([]);
  });

  it("põe em quarentena na hora o cliente que perdeu a tabela PRINCIPAL depois da conferência", async () => {
    const oracle = oracleDoErp({ cadastro: [] });
    expect((await gravarConferidos(pasta, oracle)).quarentena).toEqual([{ pedido: "CRM-00001", motivo: expect.stringMatching(/PRINCIPAL/) }]);
    expect(execucoes(oracle)).toEqual([]);
  });
});
