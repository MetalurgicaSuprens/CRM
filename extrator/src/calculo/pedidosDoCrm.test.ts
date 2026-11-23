import { describe, expect, it } from "vitest";
import type { PedidoDoCrmNaLan } from "../pedidos/andamento.ts";
import { montarPedidosDoCrm, type PedidosDoErp } from "./pedidosDoCrm.ts";

const SEM_ERP: PedidosDoErp = { emAberto: new Set(), comNota: new Set() };

function gravado(statusNoSgi: string | null): PedidoDoCrmNaLan {
  return { numero: "CRM-00001", recebidoEm: "2026-11-23T16:10", situacao: "gravado", numeroSgi: 1149872, gravadoEm: "2026-11-23T16:10", statusNoSgi, totalNoSgi: 295.2 };
}

function etapa(pedido: PedidoDoCrmNaLan, erp = SEM_ERP): string | undefined {
  return montarPedidosDoCrm([pedido], erp)[0]?.etapa;
}

describe("montarPedidosDoCrm", () => {
  it("o pedido que só chegou à LAN está recebido, com a hora", () => {
    expect(montarPedidosDoCrm([{ numero: "CRM-00002", recebidoEm: "2026-11-23T16:05", situacao: "recebido" }], SEM_ERP)).toEqual([
      { numero: "CRM-00002", etapa: "recebido", numero_sgi: null, numero_erp: null, total_sgi: null, motivo_recusa: null, historico: '[{"etapa":"recebido","em":"2026-11-23T16:05"}]' },
    ]);
  });

  it("o recusado leva o motivo e encerra o caminho na recusa", () => {
    const [linha] = montarPedidosDoCrm([{ numero: "CRM-00003", recebidoEm: "2026-11-23T16:05", situacao: "recusado", motivo: "o cliente está inativo no cadastro do SGI", recusadoEm: "2026-11-23T16:06" }], SEM_ERP);
    expect(linha).toMatchObject({ etapa: "recusado", motivo_recusa: "o cliente está inativo no cadastro do SGI" });
    expect(JSON.parse(linha?.historico ?? "")).toEqual([
      { etapa: "recebido", em: "2026-11-23T16:05" },
      { etapa: "recusado", em: "2026-11-23T16:06" },
    ]);
  });

  it("o gravado leva o número e o total do SGI e a hora da gravação", () => {
    expect(montarPedidosDoCrm([gravado("PEDIDO BLOQUEADO")], SEM_ERP)[0]).toMatchObject({ etapa: "em_aprovacao", numero_sgi: "1149872", numero_erp: null, total_sgi: 295.2 });
  });

  it.each([
    ["COTACAO", "em_aprovacao"],
    ["PEDIDO BLOQUEADO", "em_aprovacao"],
    ["PEDIDO", "aprovado"],
    ["CANCELADO", "cancelado"],
  ])("o status %s no SGI é a etapa %s", (status, esperada) => {
    expect(etapa(gravado(status))).toBe(esperada);
  });

  it("no Omega, segue o saldo e as notas do pedido", () => {
    const comSaldo = { emAberto: new Set(["1149872"]), comNota: new Set<string>() };
    const parcial = { emAberto: new Set(["1149872"]), comNota: new Set(["1149872"]) };
    expect(etapa(gravado("PEDIDO OMEGA"), comSaldo)).toBe("no_erp");
    expect(etapa(gravado("PEDIDO OMEGA"), parcial)).toBe("faturado_parcial");
    expect(etapa(gravado("PEDIDO OMEGA"), SEM_ERP)).toBe("faturado");
    expect(montarPedidosDoCrm([gravado("PEDIDO OMEGA")], comSaldo)[0]?.numero_erp).toBe("1149872");
  });

  it("o cancelado no SGI encerra o caminho no cancelamento", () => {
    expect(JSON.parse(montarPedidosDoCrm([gravado("CANCELADO")], SEM_ERP)[0]?.historico ?? "").map((passo: { etapa: string }) => passo.etapa)).toEqual(["recebido", "em_aprovacao", "cancelado"]);
  });

  it("o gravado que sumiu do SGI foi excluído lá e aparece cancelado", () => {
    const [linha] = montarPedidosDoCrm([gravado(null)], SEM_ERP);
    expect(linha).toMatchObject({ etapa: "cancelado", numero_sgi: "1149872", numero_erp: null });
    expect(JSON.parse(linha?.historico ?? "").map((passo: { etapa: string }) => passo.etapa)).toEqual(["recebido", "em_aprovacao", "cancelado"]);
  });
});
