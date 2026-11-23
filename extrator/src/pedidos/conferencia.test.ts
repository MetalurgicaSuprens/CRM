import { describe, expect, it } from "vitest";
import { somarDias } from "dominio/datas";
import { primeiraEntregaPossivel } from "dominio/pedido";
import { oracleDeTeste } from "../oracleDeTeste.ts";
import { conferirNoErp, decidir, type LidoDoErp } from "./conferencia.ts";
import { pedidoDeTeste } from "./pedidoDeTeste.ts";

/** O ERP de um pedido que passa: cliente ativo de 1401, tabela principal em real e o F-100 a 95,50 o cento. */
function lidoDoErp(parcial: Partial<LidoDoErp> = {}): LidoDoErp {
  return {
    cliente: { empresa: 1, cliente: 123456, vendedor: "1401", statusNoSgi: "ATIVO", condicaoDoCadastro: "28", mercado: "PRACA" },
    tabelas: [{ cliente: 123456, tabela: "PDR02", papel: "PRINCIPAL", nome: "Tabela 17", moeda: "REAL", situacao: "ATIVO" }],
    precos: [{ cliente: 123456, tabela: "PDR02", produto: "F-100", precoCento: 95.5, aliquotaIpi: 5 }],
    isCondicaoDaFaixa: true,
    transportadora: "101",
    ...parcial,
  };
}

describe("decidir", () => {
  it("manda ao SGI o pedido que passa, com o cliente do ERP e o dono dele", () => {
    expect(decidir(pedidoDeTeste(), lidoDoErp())).toEqual({
      destino: "conferidos",
      erp: { empresa: 1, cliente: 123456, vendedor: "1401", tabela: "PDR02", condicaoDePagamento: "1030", transportadora: "101" },
    });
  });

  it.each([
    ["o cliente não é de nenhum código do login", { cliente: null }, /não é de nenhum código/],
    ["o cliente está inativo", { cliente: { ...lidoDoErp().cliente!, statusNoSgi: "INATIVO" } }, /inativo/],
    ["o status do cliente é desconhecido", { cliente: { ...lidoDoErp().cliente!, statusNoSgi: "BLOQUEADO" } }, /desconhecido/],
    ["o cliente não tem tabela em real", { tabelas: [{ ...lidoDoErp().tabelas[0]!, moeda: "DOLAR" }] }, /tabela de preço/],
    ["o produto não está na tabela", { precos: [] }, /F-100 não está na tabela/],
    ["o preço está abaixo da tabela", { precos: [{ ...lidoDoErp().precos[0]!, precoCento: 98.41 }] }, /abaixo da tabela/],
    ["a condição não é das do representante nem a do cadastro", { isCondicaoDaFaixa: false }, /condição de pagamento 1030/],
    ["a transportadora não existe no ERP", { transportadora: null }, /transportadora não existe/],
  ])("põe em quarentena quando %s", (_caso, parcial, motivo) => {
    expect(decidir(pedidoDeTeste(), lidoDoErp(parcial))).toEqual({ destino: "quarentena", motivo: expect.stringMatching(motivo) });
  });

  it("só olha os preços da tabela escolhida para o cliente", () => {
    const precos = [{ cliente: 123456, tabela: "OUTRA", produto: "F-100", precoCento: 50, aliquotaIpi: 5 }];
    expect(decidir(pedidoDeTeste(), lidoDoErp({ precos })).destino).toBe("quarentena");
  });

  it("aceita a condição do cadastro do cliente, fora da faixa do representante", () => {
    const pedido = pedidoDeTeste({ escolhas: { ...pedidoDeTeste().escolhas, condicaoDePagamento: "28" } });
    expect(decidir(pedido, lidoDoErp({ isCondicaoDaFaixa: false })).destino).toBe("conferidos");
  });

  it("conta os 5 dias úteis da entrega a partir do envio, e não de hoje", () => {
    // Enviado em 2026-11-18: com o feriado de 20/11, a primeira entrega é 2026-11-26.
    const primeira = primeiraEntregaPossivel("2026-11-18");
    expect(primeira).toBe("2026-11-26");
    expect(decidir(pedidoDeTeste({ entrega: primeira }), lidoDoErp()).destino).toBe("conferidos");
    expect(decidir(pedidoDeTeste({ entrega: somarDias(primeira, -1) }), lidoDoErp())).toMatchObject({ destino: "quarentena", motivo: expect.stringMatching(/5 dias úteis/) });
  });

  it("deixa esperando o pedido de transportadora nova que vendas ainda não cadastrou", () => {
    const transportadora = { nova: { cnpj: "11222333000181", nome: "Nova Log", cidade: "Maringá", uf: "PR" } };
    const pedido = pedidoDeTeste({ escolhas: { ...pedidoDeTeste().escolhas, transportadora } });
    expect(decidir(pedido, lidoDoErp({ transportadora: null }))).toEqual({ destino: "aguardando", motivo: expect.stringMatching(/11222333000181/) });
    expect(decidir(pedido, lidoDoErp({ transportadora: "202" }))).toMatchObject({ destino: "conferidos", erp: { transportadora: "202" } });
  });

  it("deixa seguir o pedido de valor alto, que o SGI recebe bloqueado e a Suprens libera", () => {
    const decisao = decidir(pedidoDeTeste({ itens: [{ codigo: "F-100", quantidade: 1_000_000, precoCento: 98.4, ordemDeCompra: null, itemDaOrdemDeCompra: null }] }), lidoDoErp());
    expect(decisao).toMatchObject({ destino: "conferidos", erp: { cliente: 123456 } });
  });
});

describe("conferirNoErp", () => {
  it("recusa o código de representante não autorizado nesta máquina antes de consultar o Oracle", async () => {
    const oracle = oracleDeTeste({
      consultar: () => {
        throw new Error("não devia consultar");
      },
    });
    const decisao = await conferirNoErp(oracle, pedidoDeTeste({ codigos: ["1401", "9999"] }), { chaveDoIdDoCliente: Buffer.alloc(32), autorizados: ["1401"] });
    expect(decisao).toEqual({ destino: "quarentena", motivo: "código de representante não autorizado nesta máquina: 9999" });
  });
});
