import { describe, expect, it } from "vitest";
import { TAMANHO_MAXIMO_DO_ARQUIVO, lerPedidoRecebido } from "./formato.ts";
import { pedidoDeTeste } from "./pedidoDeTeste.ts";

function ler(pedido: object, arquivo = "CRM-00001.json") {
  return lerPedidoRecebido(JSON.stringify(pedido), arquivo);
}

function motivo(pedido: object, arquivo?: string): string {
  const leitura = ler(pedido, arquivo);
  if (leitura.ok) throw new Error("o pedido passou");
  return leitura.motivo;
}

describe("lerPedidoRecebido", () => {
  it("aceita o pedido como o servidor grava", () => {
    expect(ler(pedidoDeTeste())).toEqual({ ok: true, pedido: pedidoDeTeste() });
  });

  it("aceita a transportadora nova, que espera o cadastro de vendas", () => {
    const transportadora = { nova: { cnpj: "11222333000181", nome: "Nova Log", cidade: "Maringá", uf: "PR" } };
    const pedido = pedidoDeTeste({ escolhas: { ...pedidoDeTeste().escolhas, transportadora } });
    expect(ler(pedido).ok).toBe(true);
  });

  it("recusa o conteúdo que não é o que a chave de acesso confirmou", () => {
    const pedido = pedidoDeTeste();
    expect(motivo({ ...pedido, itens: [{ codigo: "F-100", quantidade: 30_000, precoCento: 98.4 }] })).toMatch(/hash diferente/);
  });

  it("recusa o arquivo de nome diferente do número do pedido", () => {
    expect(motivo(pedidoDeTeste(), "CRM-00002.json")).toMatch(/não é o do arquivo/);
  });

  it.each([
    ["campo a mais", { ...pedidoDeTeste(), vendedor: "1401" }, /campo a mais: vendedor/],
    ["campo a menos", (({ hash: _hash, ...resto }) => resto)(pedidoDeTeste()), /sem o campo hash/],
    ["campo a mais no item", pedidoDeTeste({ itens: [{ codigo: "F-100", quantidade: 1, precoCento: 1, desconto: 5 } as never] }), /item com campo a mais/],
    ["versão desconhecida", { ...pedidoDeTeste(), versao: 2 }, /versão/],
    ["quantidade quebrada", pedidoDeTeste({ itens: [{ codigo: "F-100", quantidade: 1.5, precoCento: 98.4 }] }), /quantidade/],
    ["preço zero", pedidoDeTeste({ itens: [{ codigo: "F-100", quantidade: 1, precoCento: 0 }] }), /preço/],
    ["produto repetido", pedidoDeTeste({ itens: [{ codigo: "F-100", quantidade: 1, precoCento: 98.4 }, { codigo: "F-100", quantidade: 2, precoCento: 98.4 }] }), /duas vezes/],
    ["sem itens", pedidoDeTeste({ itens: [] }), /itens/],
    ["data que não existe", pedidoDeTeste({ entrega: "2026-02-30" }), /não existe/],
    ["caractere de controle na observação", pedidoDeTeste({ observacao: "linha\u0007" }), /observacao/],
    ["código de representante fora do formato", pedidoDeTeste({ codigos: ["14 01"] }), /código de representante/],
    ["classificação desconhecida", pedidoDeTeste({ escolhas: { ...pedidoDeTeste().escolhas, classificacao: "outra" } }), /classificação/],
    ["sem transportadora", pedidoDeTeste({ escolhas: { ...pedidoDeTeste().escolhas, transportadora: null } }), /transportadora/],
  ])("recusa o pedido com %s", (_caso, pedido, esperado) => {
    expect(motivo(pedido)).toMatch(esperado);
  });

  it("aceita a quebra de linha na observação", () => {
    expect(ler(pedidoDeTeste({ observacao: "Entregar\nde manhã" })).ok).toBe(true);
  });

  it("recusa o que não é JSON e o arquivo grande demais, sem ler o resto", () => {
    expect(lerPedidoRecebido("{", "CRM-00001.json")).toEqual({ ok: false, motivo: "o arquivo não é JSON" });
    expect(lerPedidoRecebido(" ".repeat(TAMANHO_MAXIMO_DO_ARQUIVO + 1), "CRM-00001.json")).toMatchObject({ ok: false, motivo: expect.stringMatching(/64 KB/) });
  });
});
