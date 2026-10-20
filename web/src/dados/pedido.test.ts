import { describe, expect, it } from "vitest";
import {
  STATUS_NA_FICHA,
  embalagemAnterior,
  passosDoAndamento,
  pecasEmCentos,
  precoDoCento,
  problemasDoPedido,
  proximaEmbalagem,
  quantidadeDigitada,
  resumirPorFamilia,
  totalDoPedido,
  valorDaLinha,
  type LinhaDoPedido,
} from "./pedido";

const HOJE = "2026-10-08";

function linha(parcial: Partial<LinhaDoPedido> = {}): LinhaDoPedido {
  return { codigo: "FAB12345", quantidade: 200, embalagem: 100, precoCento: 95, ...parcial };
}

describe("pecasEmCentos", () => {
  it("converte peças em CT, o cento do ERP", () => {
    expect(pecasEmCentos(250)).toBe(2.5);
  });
});

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

describe("valorDaLinha e totalDoPedido", () => {
  it("cobra o preço do cento pela quantidade em centos", () => {
    expect(valorDaLinha({ quantidade: 250, precoCento: 120 })).toBe(300);
  });

  it("soma as linhas", () => {
    expect(totalDoPedido([linha({ quantidade: 200, precoCento: 95 }), linha({ quantidade: 50, precoCento: 260 })])).toBe(320);
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

  it("recusa entrega antes de hoje e observação longa demais", () => {
    expect(problemasDoPedido([linha()], "x".repeat(301), "2026-10-01", HOJE)).toEqual([
      "A entrega desejada não pode ser antes de hoje.",
      "A observação passa de 300 caracteres.",
    ]);
  });
});
