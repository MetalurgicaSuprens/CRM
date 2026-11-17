import { describe, expect, it } from "vitest";
import {
  escolhasIniciais,
  escolhasNoCatalogo,
  formatarCnpj,
  formatarParte,
  frequencias,
  isCnpjValido,
  pedidoJaEnviadoHoje,
  problemasDasEscolhas,
  quantidadesDoUltimoPedido,
  totalComIpi,
  transportadoraDoCnpj,
  transportadoraSugerida,
  vezesQueOClienteEscolheu,
} from "./dadosDoPedido";
import type { DadosDoPedido } from "./tipos";

function dados(mudancas: Partial<DadosDoPedido> = {}): DadosDoPedido {
  return {
    condicaoDoCadastro: "1030",
    condicoes: [
      { codigo: "1030", descricao: "30 DIAS" },
      { codigo: "1060", descricao: "30/60 DIAS" },
    ],
    condicoesUsadas: [],
    classificacoesUsadas: [],
    parcialUsado: { aceita: 0, naoAceita: 0 },
    transportadoras: [
      { codigo: "101", nome: "Rápido Sul", cnpj: "11.222.333/0001-81", cidade: "Curitiba", uf: "PR" },
      { codigo: "102", nome: "Expresso Norte", cnpj: "45.997.418/0001-53", cidade: "Joinville", uf: "SC" },
    ],
    transportadorasDoCliente: [],
    transportadorasDoRepresentante: [],
    ipi: {},
    ultimoPedido: null,
    ...mudancas,
  };
}

describe("frequencias", () => {
  it("dá a fatia de cada escolha, da mais usada à menos usada, sem as que nunca foram usadas", () => {
    expect(
      frequencias([
        { valor: "102", pedidos: 1 },
        { valor: "101", pedidos: 49 },
        { valor: "103", pedidos: 0 },
      ]),
    ).toEqual([
      { valor: "101", pedidos: 49, parte: 0.98 },
      { valor: "102", pedidos: 1, parte: 0.02 },
    ]);
  });
});

describe("transportadoraSugerida", () => {
  it("escolhe a transportadora que o cliente usa em pelo menos 80% dos pedidos", () => {
    expect(transportadoraSugerida({ transportadorasDoCliente: [{ valor: "101", pedidos: 8 }, { valor: "102", pedidos: 2 }] })).toBe("101");
  });

  it("não escolhe nenhuma quando o cliente divide entre várias", () => {
    expect(transportadoraSugerida({ transportadorasDoCliente: [{ valor: "101", pedidos: 7 }, { valor: "102", pedidos: 3 }] })).toBeNull();
  });

  it("não escolhe nenhuma para o cliente sem histórico", () => {
    expect(transportadoraSugerida({ transportadorasDoCliente: [] })).toBeNull();
  });
});

describe("escolhasIniciais", () => {
  it("começa com a condição do cadastro e o que o cliente mais usou", () => {
    const escolhas = escolhasIniciais(
      dados({
        classificacoesUsadas: [{ valor: "industrializacao", pedidos: 9 }, { valor: "comercializacao", pedidos: 1 }],
        parcialUsado: { aceita: 6, naoAceita: 2 },
        transportadorasDoCliente: [{ valor: "102", pedidos: 10 }],
      }),
    );
    expect(escolhas).toEqual({ condicaoDePagamento: "1030", classificacao: "industrializacao", pedidoDoCliente: "", aceitaParcial: true, transportadora: { codigo: "102" } });
  });

  it("sem histórico, fica como o SGI6R: comercialização, sem frete parcial e sem transportadora", () => {
    expect(escolhasIniciais(dados())).toMatchObject({ classificacao: "comercializacao", aceitaParcial: false, transportadora: null });
  });
});

describe("vezesQueOClienteEscolheu", () => {
  const usos = [{ valor: "101", pedidos: 49 }, { valor: "102", pedidos: 1 }];

  it("conta os pedidos com a mesma escolha", () => {
    expect(vezesQueOClienteEscolheu(usos, "101")).toBe("em 49 de 50 pedidos");
  });

  it("diz todos quando o cliente nunca escolheu outra", () => {
    expect(vezesQueOClienteEscolheu([{ valor: "101", pedidos: 12 }], "101")).toBe("em todos os 12 pedidos");
  });

  it("é null para o que o cliente nunca escolheu", () => {
    expect(vezesQueOClienteEscolheu(usos, "999")).toBeNull();
  });
});

describe("formatarParte", () => {
  it("arredonda sem mostrar 0% nem 100% quando a conta não é exata", () => {
    expect(formatarParte(0.98)).toBe("98%");
    expect(formatarParte(0.002)).toBe("<1%");
    expect(formatarParte(0.998)).toBe(">99%");
    expect(formatarParte(1)).toBe("100%");
  });
});

describe("CNPJ da transportadora nova", () => {
  it("aceita o CNPJ com os dígitos verificadores certos, com ou sem pontuação", () => {
    expect(isCnpjValido("11.222.333/0001-81")).toBe(true);
    expect(isCnpjValido("11222333000181")).toBe(true);
  });

  it("recusa dígito verificador errado, tamanho errado e todos os dígitos iguais", () => {
    expect(isCnpjValido("11.222.333/0001-82")).toBe(false);
    expect(isCnpjValido("1122233300018")).toBe(false);
    expect(isCnpjValido("00000000000000")).toBe(false);
  });

  it("formata os 14 dígitos", () => {
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("acha a transportadora do ERP com o mesmo CNPJ, para não cadastrar de novo", () => {
    expect(transportadoraDoCnpj(dados(), "45997418000153")?.codigo).toBe("102");
    expect(transportadoraDoCnpj(dados(), "11444777000161")).toBeNull();
  });
});

describe("problemasDasEscolhas", () => {
  it("pede a transportadora", () => {
    expect(problemasDasEscolhas(escolhasIniciais(dados()))).toEqual(["Escolha a transportadora."]);
  });

  it("aceita a transportadora nova, que espera o cadastro de vendas", () => {
    const escolhas = { ...escolhasIniciais(dados()), transportadora: { nova: { cnpj: "11444777000161", nome: "Nova Log", cidade: "Maringá", uf: "PR" } } };
    expect(problemasDasEscolhas(escolhas)).toEqual([]);
  });
});

describe("totalComIpi", () => {
  it("soma o IPI de cada produto ao valor dele", () => {
    const itens = [
      { codigo: "A", quantidade: 1_000, precoCento: 10 },
      { codigo: "B", quantidade: 500, precoCento: 20 },
    ];
    expect(totalComIpi(itens, { A: 5, B: 0 })).toBe(205);
  });
});

describe("quantidadesDoUltimoPedido", () => {
  it("repete as quantidades só dos produtos que continuam no catálogo", () => {
    const ultimo = { data: "2026-10-01", itens: [{ codigo: "A", quantidade: 500 }, { codigo: "SAIU", quantidade: 200 }] };
    expect(quantidadesDoUltimoPedido(ultimo, [{ codigo: "A" }, { codigo: "B" }])).toEqual({ A: 500 });
  });
});

describe("pedidoJaEnviadoHoje", () => {
  const cliente = (codigo: string) => ({ codigo }) as never;

  it("acha o pedido mais recente de hoje para o mesmo cliente", () => {
    const enviados = [
      { cliente: cliente("c1"), enviadoEm: "2026-11-17T09:05" },
      { cliente: cliente("c1"), enviadoEm: "2026-11-17T10:12" },
      { cliente: cliente("c2"), enviadoEm: "2026-11-17T11:00" },
      { cliente: cliente("c1"), enviadoEm: "2026-11-16T15:00" },
    ];
    expect(pedidoJaEnviadoHoje(enviados, "c1", "2026-11-17")).toBe("2026-11-17T10:12");
  });

  it("é null sem pedido de hoje para o cliente", () => {
    expect(pedidoJaEnviadoHoje([{ cliente: cliente("c1"), enviadoEm: "2026-11-16T15:00" }], "c1", "2026-11-17")).toBeNull();
  });
});

describe("escolhasNoCatalogo", () => {
  it("mantém as escolhas do rascunho que ainda valem", () => {
    const salvas = { condicaoDePagamento: "1060", classificacao: "uso_consumo" as const, pedidoDoCliente: "OC 77", aceitaParcial: true, transportadora: { codigo: "101" } };
    expect(escolhasNoCatalogo(salvas, dados())).toEqual(salvas);
  });

  it("volta ao começo a condição e a transportadora que saíram do ERP", () => {
    const salvas = { condicaoDePagamento: "9999", classificacao: "comercializacao" as const, pedidoDoCliente: "", aceitaParcial: false, transportadora: { codigo: "999" } };
    expect(escolhasNoCatalogo(salvas, dados())).toMatchObject({ condicaoDePagamento: "1030", transportadora: null });
  });

  it("começa do zero sem escolhas salvas", () => {
    expect(escolhasNoCatalogo(null, dados())).toEqual(escolhasIniciais(dados()));
  });
});
