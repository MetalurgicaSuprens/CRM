import { describe, expect, it } from "vitest";
import {
  condicaoInicial,
  aliquotaDoIpi,
  condicoesDoEnvio,
  condicoesDoErp,
  descricaoDaCondicao,
  textoDaEntrega,
  transportadoraParaMostrar,
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
import type { CondicoesDoPedidoNoErp, DadosDoPedido } from "./tipos";

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

describe("o pedido para mostrar", () => {
  it("mostra a transportadora do ERP com a razão social, o CNPJ inteiro e o endereço", () => {
    const comEndereco = dados({ transportadoras: [{ ...dados().transportadoras[0]!, endereco: "Rua B, 20", bairro: "Centro", cep: "80010000" }] });
    expect(transportadoraParaMostrar(comEndereco, { codigo: "101" })).toEqual({
      nome: "Rápido Sul Transportes Ltda",
      cnpj: "11.222.333/0001-81",
      local: "Rua B, 20 · Centro · Curitiba/PR · 80010-000",
    });
  });

  it("mostra a transportadora nova como o representante a informou", () => {
    const nova = { nova: { cnpj: "45997418000153", nome: "Nova Log", cidade: "Maringá", uf: "PR" } };
    expect(transportadoraParaMostrar(dados(), nova)).toEqual({ nome: "Nova Log", cnpj: "45.997.418/0001-53", local: "Maringá/PR" });
  });

  it("sem escolha, ou com a que saiu do cadastro, não mostra transportadora", () => {
    expect(transportadoraParaMostrar(dados(), null)).toBeNull();
    expect(transportadoraParaMostrar(dados(), { codigo: "999" })).toBeNull();
  });

  it("mostra a descrição da condição de pagamento, ou o código quando ela saiu do cadastro", () => {
    expect(descricaoDaCondicao(dados(), "1060")).toBe("30/60 DIAS");
    expect(descricaoDaCondicao(dados(), "9999")).toBe("9999");
  });

  it("mostra a entrega programada ou a primeira possível, 5 dias úteis depois do dia", () => {
    expect(textoDaEntrega("2026-12-05", "2026-11-23")).toBe("Programada para 05/12/2026");
    expect(textoDaEntrega(null, "2026-11-23")).toBe("Assim que possível, a partir de 30/11/2026");
  });
});

describe("condições para mostrar", () => {
  const doErp: CondicoesDoPedidoNoErp = {
    numero: "1149882",
    transportadora: dados().transportadoras[0]!,
    condicaoDePagamento: "30/60 DIAS",
    tipoDeEntrega: "programada",
    entrega: "2026-12-04",
    ordemDeCompra: "4500123987",
    classificacao: "uso_consumo",
    aceitaParcial: false,
    pagamentoDoFrete: "T",
    observacao: "Entregar na doca 3.",
    temItemDaOrdemDeCompra: true,
  };

  it("mostra o pedido do ERP com os textos do app antigo e a transportadora inteira", () => {
    expect(condicoesDoErp(doErp)).toEqual({
      transportadora: { nome: "Rápido Sul Transportes Ltda", cnpj: "11.222.333/0001-81", local: "Curitiba/PR" },
      condicaoDePagamento: "30/60 DIAS",
      entrega: "Programada para 04/12/2026",
      ordemDeCompra: "4500123987",
      classificacao: "Uso e consumo",
      xped: { rotulo: "Item da ordem de compra (xPed)", texto: "Sim, nos itens" },
      freteParcial: "Não aceita",
      pagamentoDoFrete: "A pagar pelo cliente à transportadora",
      observacao: "Entregar na doca 3.",
    });
  });

  it("no pedido do ERP, mostra o que o SGI não tem como sem", () => {
    const vazio = { ...doErp, transportadora: null, tipoDeEntrega: null, entrega: null, classificacao: null, aceitaParcial: null, pagamentoDoFrete: null, temItemDaOrdemDeCompra: false };
    expect(condicoesDoErp(vazio)).toMatchObject({ transportadora: null, entrega: "—", classificacao: null, freteParcial: null, pagamentoDoFrete: null, xped: { texto: "Não" } });
    expect(condicoesDoErp({ ...doErp, tipoDeEntrega: "imediata" }).entrega).toBe("Assim que possível");
  });

  it("mostra o pedido enviado pelo CRM com as escolhas do envio, sem o pagamento do frete, que ele não pergunta", () => {
    const escolhas = { condicaoDePagamento: "1060", classificacao: "industrializacao" as const, pedidoDoCliente: " ", aceitaParcial: true, clienteXped: true, transportadora: { codigo: "102" } };
    expect(condicoesDoEnvio({ escolhas, entrega: null, enviadoEm: "2026-11-23T16:00", observacao: "" }, dados())).toEqual({
      transportadora: { nome: "Expresso Norte Ltda", cnpj: "45.997.418/0001-53", local: "Joinville/SC" },
      condicaoDePagamento: "30/60 DIAS",
      entrega: "Assim que possível, a partir de 30/11/2026",
      ordemDeCompra: null,
      classificacao: "Industrialização",
      xped: { rotulo: "Cliente exige xPed", texto: "Sim" },
      freteParcial: "Aceita",
      pagamentoDoFrete: null,
      observacao: null,
    });
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
  it("repete, na ordem do pedido, só os produtos que continuam no catálogo, com o part number sugerido", () => {
    const ultimo = { data: "2026-10-01", itens: [{ codigo: "B", quantidade: 300 }, { codigo: "SAIU", quantidade: 200 }, { codigo: "A", quantidade: 500 }] };
    const semPartNumber = { opcoes: [], sugerido: null };
    const produtos = [{ codigo: "A", partNumberDoCliente: semPartNumber }, { codigo: "B", partNumberDoCliente: { opcoes: ["01853"], sugerido: "01853" } }];
    expect(itensDoUltimoPedido(ultimo, produtos)).toEqual([
      { codigo: "B", quantidade: 300, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: "01853" },
      { codigo: "A", quantidade: 500, ordemDeCompra: null, itemDaOrdemDeCompra: null, partNumber: null },
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
