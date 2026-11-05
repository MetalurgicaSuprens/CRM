import { describe, expect, it } from "vitest";
import {
  STATUS_NA_FICHA,
  embalagemAnterior,
  passosDoAndamento,
  precoDigitado,
  precoDoCento,
  precoInicialDoItem,
  problemasDoPedido,
  proximaEmbalagem,
  quantidadeDigitada,
  rascunhoNoCatalogo,
  resumirPorFamilia,
  type LinhaDoPedido,
} from "./pedido";

const HOJE = "2026-10-08";

function linha(parcial: Partial<LinhaDoPedido> = {}): LinhaDoPedido {
  return { codigo: "FAB12345", quantidade: 200, embalagem: 100, precoCento: 95, ...parcial };
}

describe("precoDoCento", () => {
  it("divide o valor do item do ERP pelos centos dele", () => {
    expect(precoDoCento({ pecas: 2_500, valor: 2_375 })).toBe(95);
  });

  it("dá 0 ao item sem peças, em vez de dividir por zero", () => {
    expect(precoDoCento({ pecas: 0, valor: 100 })).toBe(0);
  });
});

describe("quantidadeDigitada", () => {
  it("fica com o que foi digitado, também fora da embalagem", () => {
    expect(quantidadeDigitada("300")).toBe(300);
    expect(quantidadeDigitada("1")).toBe(1);
  });

  it("arredonda para peças inteiras", () => {
    expect(quantidadeDigitada("299.6")).toBe(300);
  });

  it("zera quantidade negativa, zerada, vazia ou que não é número", () => {
    expect(quantidadeDigitada("-5")).toBe(0);
    expect(quantidadeDigitada("0")).toBe(0);
    expect(quantidadeDigitada("")).toBe(0);
    expect(quantidadeDigitada("abc")).toBe(0);
  });
});

describe("proximaEmbalagem e embalagemAnterior", () => {
  it("o + vai à próxima embalagem fechada, também de uma quantidade fora dela", () => {
    expect(proximaEmbalagem(0, 500)).toBe(500);
    expect(proximaEmbalagem(300, 500)).toBe(500);
    expect(proximaEmbalagem(500, 500)).toBe(1_000);
  });

  it("o − volta à embalagem fechada de baixo, sem passar de zero", () => {
    expect(embalagemAnterior(1_200, 500)).toBe(1_000);
    expect(embalagemAnterior(1_000, 500)).toBe(500);
    expect(embalagemAnterior(300, 500)).toBe(0);
    expect(embalagemAnterior(0, 500)).toBe(0);
  });
});

describe("precoInicialDoItem", () => {
  it("usa o preço da última compra", () => {
    expect(precoInicialDoItem({ precoDaTabela: 95.5, ultimaCompra: { precoCento: 98.4, data: "2026-09-15" } })).toBe(98.4);
  });

  it("não fica abaixo da tabela do cliente, quando a última compra saiu mais barata", () => {
    expect(precoInicialDoItem({ precoDaTabela: 95.5, ultimaCompra: { precoCento: 90, data: "2025-01-10" } })).toBe(95.5);
  });

  it("sem última compra, usa a tabela", () => {
    expect(precoInicialDoItem({ precoDaTabela: 95.5, ultimaCompra: null })).toBe(95.5);
  });
});

describe("rascunhoNoCatalogo", () => {
  const produtos = [
    { codigo: "FAB1422P", precoDaTabela: 95.5 },
    { codigo: "MAB1216P", precoDaTabela: 120 },
  ];

  it("deixa como está o rascunho que cabe no catálogo de hoje", () => {
    const itens = [{ codigo: "FAB1422P", quantidade: 300, precoCento: 98.4 }];
    expect(rascunhoNoCatalogo(itens, produtos)).toEqual({ itens, foraDoCatalogo: 0, subiramAoMinimo: 0 });
  });

  it("tira o produto que saiu do catálogo e sobe para a tabela o preço que ficou abaixo dela", () => {
    const itens = [
      { codigo: "FAB1422P", quantidade: 300, precoCento: 90 },
      { codigo: "SAIU", quantidade: 100, precoCento: 50 },
      { codigo: "MAB1216P", quantidade: 500, precoCento: 130 },
    ];
    expect(rascunhoNoCatalogo(itens, produtos)).toEqual({
      itens: [
        { codigo: "FAB1422P", quantidade: 300, precoCento: 95.5 },
        { codigo: "MAB1216P", quantidade: 500, precoCento: 130 },
      ],
      foraDoCatalogo: 1,
      subiramAoMinimo: 1,
    });
  });
});

describe("precoDigitado", () => {
  it("lê o preço com vírgula, com o ponto dos milhares ou com o ponto decimal, no centavo", () => {
    expect(precoDigitado("123,45", 50)).toEqual({ preco: 123.45, subiuAoMinimo: false });
    expect(precoDigitado("R$ 1.234,567", 50)).toEqual({ preco: 1234.57, subiuAoMinimo: false });
    expect(precoDigitado("123.45", 50)).toEqual({ preco: 123.45, subiuAoMinimo: false });
    expect(precoDigitado("1.234", 50)).toEqual({ preco: 1234, subiuAoMinimo: false });
  });

  it("sobe para o mínimo o preço abaixo da tabela do cliente", () => {
    expect(precoDigitado("80", 95.5)).toEqual({ preco: 95.5, subiuAoMinimo: true });
  });

  it("devolve null para o que não é preço", () => {
    expect(precoDigitado("", 95.5)).toBeNull();
    expect(precoDigitado("abc", 95.5)).toBeNull();
    expect(precoDigitado("0", 95.5)).toBeNull();
    expect(precoDigitado("-10", 95.5)).toBeNull();
  });
});

describe("resumirPorFamilia", () => {
  it("soma as peças e o valor dos itens de cada família", () => {
    const resumo = resumirPorFamilia([
      { familia: "FLEXIL", pecas: 1_000, valor: 700 },
      { familia: "PRESIL", pecas: 200, valor: 900 },
      { familia: "FLEXIL", pecas: 500, valor: 350 },
    ]);
    expect(resumo).toEqual([
      { familia: "FLEXIL", pecas: 1_500, valor: 1_050 },
      { familia: "PRESIL", pecas: 200, valor: 900 },
    ]);
  });

  it("começa pela família de maior valor, não pela de mais peças", () => {
    const resumo = resumirPorFamilia([
      { familia: "MICRO", pecas: 5_000, valor: 400 },
      { familia: "RADIAL", pecas: 100, valor: 2_000 },
    ]);
    expect(resumo.map(({ familia }) => familia)).toEqual(["RADIAL", "MICRO"]);
  });
});

describe("STATUS_NA_FICHA", () => {
  it("deixa o pedido como enviado pelo CRM até ele chegar ao ERP", () => {
    expect(STATUS_NA_FICHA.enviado).toBe("enviado");
    expect(STATUS_NA_FICHA.recebido).toBe("enviado");
    expect(STATUS_NA_FICHA.em_aprovacao).toBe("enviado");
    expect(STATUS_NA_FICHA.aprovado).toBe("enviado");
  });

  it("dá ao pedido que chegou ao ERP o status de lá: em aberto até faturar tudo", () => {
    expect(STATUS_NA_FICHA.no_erp).toBe("em_aberto");
    expect(STATUS_NA_FICHA.faturado_parcial).toBe("em_aberto");
    expect(STATUS_NA_FICHA.faturado).toBe("faturado");
  });

  it("tira da ficha o recusado e o cancelado, que não viraram pedido", () => {
    expect(STATUS_NA_FICHA.recusado).toBeNull();
    expect(STATUS_NA_FICHA.cancelado).toBeNull();
  });
});

describe("passosDoAndamento", () => {
  const estados = (passos: ReturnType<typeof passosDoAndamento>) => passos.map(({ etapa, estado }) => `${etapa}:${estado}`);

  it("mostra o caminho todo, com o que já aconteceu, o passo atual e o que falta", () => {
    const passos = passosDoAndamento({
      etapa: "em_aprovacao",
      historico: [
        { etapa: "enviado", em: "2026-10-07T15:10" },
        { etapa: "recebido", em: "2026-10-07T15:16" },
        { etapa: "em_aprovacao", em: "2026-10-07T15:22" },
      ],
    });
    expect(estados(passos)).toEqual([
      "enviado:feito",
      "recebido:feito",
      "em_aprovacao:atual",
      "aprovado:futuro",
      "no_erp:futuro",
      "faturado:futuro",
    ]);
    expect(passos[2]?.em).toBe("2026-10-07T15:22");
    expect(passos[3]?.em).toBeNull();
  });

  it("troca o último passo por faturado em parte quando a nota não cobriu tudo", () => {
    const passos = passosDoAndamento({
      etapa: "faturado_parcial",
      historico: ["enviado", "recebido", "em_aprovacao", "aprovado", "no_erp", "faturado_parcial"].map((etapa) => ({
        etapa: etapa as "enviado",
        em: "2026-10-01T10:00",
      })),
    });
    expect(passos.at(-1)).toMatchObject({ etapa: "faturado_parcial", estado: "atual" });
  });

  it("encerra o caminho no pedido recusado", () => {
    const passos = passosDoAndamento({
      etapa: "recusado",
      historico: [
        { etapa: "enviado", em: "2026-09-29T10:00" },
        { etapa: "recusado", em: "2026-09-29T10:06" },
      ],
    });
    expect(estados(passos)).toEqual(["enviado:feito", "recusado:atual"]);
  });
});

describe("problemasDoPedido", () => {
  it("libera o pedido com produto e entrega futura", () => {
    expect(problemasDoPedido([linha()], "", "2026-10-20", HOJE)).toEqual([]);
  });

  it("exige pelo menos um produto com quantidade", () => {
    expect(problemasDoPedido([], "", null, HOJE)).toEqual(["Inclua pelo menos um produto."]);
    expect(problemasDoPedido([linha({ quantidade: 0 })], "", null, HOJE)).toEqual(["Inclua pelo menos um produto."]);
  });

  it("aceita quantidade fora da embalagem: 300 peças de um item de 500", () => {
    expect(problemasDoPedido([linha({ quantidade: 300, embalagem: 500 })], "", null, HOJE)).toEqual([]);
  });

  it("aceita a entrega no 5º dia útil depois de hoje", () => {
    // HOJE é a quinta 08/10/2026, e o 12 é feriado: o 5º dia útil é a sexta 16.
    expect(problemasDoPedido([linha()], "", "2026-10-16", HOJE)).toEqual([]);
  });

  it("recusa entrega a menos de 5 dias úteis e observação longa demais", () => {
    expect(problemasDoPedido([linha()], "x".repeat(301), "2026-10-15", HOJE)).toEqual([
      "A entrega desejada precisa ser a partir de 16/10/2026: 5 dias úteis depois de hoje.",
      "A observação passa de 300 caracteres.",
    ]);
  });
});
