import { describe, expect, it } from "vitest";
import {
  condicaoInicial,
  aliquotaDoIpi,
  isClienteXped,
  pesoDosItens,
  escolhasIniciais,
  escolhasNoCatalogo,
  formatarCnpj,
  formatarParte,
  frequencias,
  isCnpjValido,
  pedidoJaEnviadoHoje,
  problemasDasEscolhas,
  itensDoUltimoPedido,
  totaisDoPedido,
  transportadoraDoCnpj,
  transportadoraSugerida,
  vezesQueOClienteEscolheu,
} from "./dadosDoPedido";
import type { DadosDoPedido } from "./tipos";

function dados(mudancas: Partial<DadosDoPedido> = {}): DadosDoPedido {
  return {
    cadastro: {
      razaoSocial: "Cliente de Teste Ltda",
      documento: "11.444.777/0001-61",
      inscricaoEstadual: null,
      suframa: null,
      telefone: null,
      emailDoXml: null,
      faturamento: { texto: "Rua A, 1", bairro: null, cidade: "Curitiba", uf: "PR", cep: null },
      cobranca: null,
      entrega: null,
    },
    condicaoDoCadastro: "1030",
    condicoes: [
      { codigo: "1030", descricao: "30 DIAS" },
      { codigo: "1060", descricao: "30/60 DIAS" },
    ],
    condicoesUsadas: [],
    classificacoesUsadas: [],
    parcialUsado: { aceita: 0, naoAceita: 0 },
    xpedUsado: { com: 0, sem: 0 },
    transportadoras: [
      { codigo: "101", nome: "Rápido Sul", razaoSocial: "Rápido Sul Transportes Ltda", cnpj: "11.222.333/0001-81", endereco: null, bairro: null, cep: null, cidade: "Curitiba", uf: "PR" },
      { codigo: "102", nome: "Expresso Norte", razaoSocial: "Expresso Norte Ltda", cnpj: "45.997.418/0001-53", endereco: null, bairro: null, cep: null, cidade: "Joinville", uf: "SC" },
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

describe("condicaoInicial", () => {
  it("começa na condição que o cliente mais usou, mesmo diferente da do cadastro", () => {
    expect(condicaoInicial(dados({ condicoesUsadas: [{ valor: "1030", pedidos: 3 }, { valor: "1060", pedidos: 7 }] }))).toBe("1060");
  });

  it("pula a condição usada que não se pode mais escolher", () => {
    expect(condicaoInicial(dados({ condicoesUsadas: [{ valor: "9999", pedidos: 9 }, { valor: "1060", pedidos: 2 }] }))).toBe("1060");
  });

  it("sem histórico, começa na do cadastro", () => {
    expect(condicaoInicial(dados())).toBe("1030");
  });
});

describe("pesoDosItens", () => {
  it("pesa cada item pelo peso de uma peça vezes as peças, e soma o total sem os itens sem peso", () => {
    const pesos = new Map<string, number | null>([["A", 0.02175], ["B", null]]);
    const peso = pesoDosItens([{ codigo: "A", quantidade: 500 }, { codigo: "B", quantidade: 100 }], pesos);
    expect(peso.porItem[0]).toBeCloseTo(10.875);
    expect(peso.porItem[1]).toBeNull();
    expect(peso.total).toBeCloseTo(10.875);
    expect(peso.semPeso).toBe(1);
  });
});

describe("aliquotaDoIpi", () => {
  it("dá a alíquota do pedido: o IPI sobre o valor sem IPI, a média quando os produtos têm alíquotas diferentes", () => {
    expect(aliquotaDoIpi({ semIpi: 1_000, ipi: 50 })).toBe(5);
    expect(aliquotaDoIpi({ semIpi: 5_304.85, ipi: 150.73 })).toBeCloseTo(2.841, 3);
  });

  it("não dá alíquota sem valor ou sem o IPI", () => {
    expect(aliquotaDoIpi({ semIpi: 0, ipi: 0 })).toBeNull();
    expect(aliquotaDoIpi({ semIpi: 100, ipi: null })).toBeNull();
  });
});

describe("isClienteXped", () => {
  it("marca o cliente que mandou o item da ordem de compra em pelo menos metade dos pedidos", () => {
    expect(isClienteXped({ xpedUsado: { com: 5, sem: 5 } })).toBe(true);
    expect(isClienteXped({ xpedUsado: { com: 2, sem: 9 } })).toBe(false);
    expect(isClienteXped({ xpedUsado: { com: 0, sem: 0 } })).toBe(false);
  });
});

describe("escolhasIniciais", () => {
  it("começa com o que o cliente mais usou", () => {
    const escolhas = escolhasIniciais(
      dados({
        condicoesUsadas: [{ valor: "1030", pedidos: 8 }],
        classificacoesUsadas: [{ valor: "industrializacao", pedidos: 9 }, { valor: "comercializacao", pedidos: 1 }],
        parcialUsado: { aceita: 6, naoAceita: 2 },
        transportadorasDoCliente: [{ valor: "102", pedidos: 10 }],
      }),
    );
    expect(escolhas).toEqual({ condicaoDePagamento: "1030", classificacao: "industrializacao", pedidoDoCliente: "", aceitaParcial: true, clienteXped: false, transportadora: { codigo: "102" } });
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

describe("totaisDoPedido", () => {
  const itens = [
    { codigo: "A", quantidade: 1_000, precoCento: 10 },
    { codigo: "B", quantidade: 500, precoCento: 20 },
  ];

  it("conta os itens e as peças e soma o IPI de cada produto ao valor dele", () => {
    expect(totaisDoPedido(itens, { A: 5, B: 0 })).toEqual({ itens: 2, pecas: 1_500, semIpi: 200, ipi: 5, comIpi: 205 });
  });

  it("fecha no centavo: o valor com IPI é o sem IPI mais o IPI que a tela mostra", () => {
    const totais = totaisDoPedido([{ codigo: "A", quantidade: 333, precoCento: 9.99 }], { A: 3.25 });
    expect(totais).toMatchObject({ semIpi: 33.27, ipi: 1.08, comIpi: 34.35 });
  });

  it("sem as alíquotas, deixa o IPI de fora", () => {
    expect(totaisDoPedido(itens, null)).toMatchObject({ semIpi: 200, ipi: null, comIpi: null });
  });
});

describe("itensDoUltimoPedido", () => {
  it("repete, na ordem do pedido, só os produtos que continuam no catálogo", () => {
    const ultimo = { data: "2026-10-01", itens: [{ codigo: "B", quantidade: 300 }, { codigo: "SAIU", quantidade: 200 }, { codigo: "A", quantidade: 500 }] };
    expect(itensDoUltimoPedido(ultimo, [{ codigo: "A" }, { codigo: "B" }])).toEqual([
      { codigo: "B", quantidade: 300, ordemDeCompra: null, itemDaOrdemDeCompra: null },
      { codigo: "A", quantidade: 500, ordemDeCompra: null, itemDaOrdemDeCompra: null },
    ]);
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
  it("mantém as escolhas da cotação que ainda valem", () => {
    const salvas = { condicaoDePagamento: "1060", classificacao: "uso_consumo" as const, pedidoDoCliente: "OC 77", aceitaParcial: true, clienteXped: true, transportadora: { codigo: "101" } };
    expect(escolhasNoCatalogo(salvas, dados())).toEqual(salvas);
  });

  it("volta ao começo a condição e a transportadora que saíram do ERP", () => {
    const salvas = { condicaoDePagamento: "9999", classificacao: "comercializacao" as const, pedidoDoCliente: "", aceitaParcial: false, clienteXped: false, transportadora: { codigo: "999" } };
    expect(escolhasNoCatalogo(salvas, dados())).toMatchObject({ condicaoDePagamento: "1030", transportadora: null });
  });

  it("dá à cotação salva antes da marca xPed a do histórico do cliente", () => {
    const salvas = { condicaoDePagamento: "1030", classificacao: "comercializacao" as const, pedidoDoCliente: "", aceitaParcial: false, transportadora: null };
    expect(escolhasNoCatalogo(salvas as never, dados({ xpedUsado: { com: 9, sem: 1 } })).clienteXped).toBe(true);
  });

  it("começa do zero sem escolhas salvas", () => {
    expect(escolhasNoCatalogo(null, dados())).toEqual(escolhasIniciais(dados()));
  });
});
