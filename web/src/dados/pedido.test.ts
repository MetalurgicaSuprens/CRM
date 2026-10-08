import { describe, expect, it } from "vitest";
import {
  ajustarAEmbalagem,
  passosDoAndamento,
  pecasEmCentos,
  problemasDoPedido,
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

describe("ajustarAEmbalagem", () => {
  it("arredonda para cima até fechar a embalagem", () => {
    expect(ajustarAEmbalagem(130, 100)).toBe(200);
    expect(ajustarAEmbalagem(200, 100)).toBe(200);
    expect(ajustarAEmbalagem(1, 50)).toBe(50);
  });

  it("zera quantidade negativa, zerada ou que não é número", () => {
    expect(ajustarAEmbalagem(-5, 100)).toBe(0);
    expect(ajustarAEmbalagem(0, 100)).toBe(0);
    expect(ajustarAEmbalagem(Number.NaN, 100)).toBe(0);
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
  it("libera o pedido com produto, embalagens fechadas e entrega futura", () => {
    expect(problemasDoPedido([linha()], "", "2026-10-20", HOJE)).toEqual([]);
  });

  it("exige pelo menos um produto com quantidade", () => {
    expect(problemasDoPedido([], "", null, HOJE)).toEqual(["Inclua pelo menos um produto."]);
    expect(problemasDoPedido([linha({ quantidade: 0 })], "", null, HOJE)).toEqual(["Inclua pelo menos um produto."]);
  });

  it("recusa quantidade que não fecha a embalagem", () => {
    expect(problemasDoPedido([linha({ quantidade: 150 })], "", null, HOJE)).toEqual([
      "FAB12345: a quantidade precisa fechar embalagens de 100 peças.",
    ]);
  });

  it("recusa entrega antes de hoje e observação longa demais", () => {
    expect(problemasDoPedido([linha()], "x".repeat(301), "2026-10-01", HOJE)).toEqual([
      "A entrega desejada não pode ser antes de hoje.",
      "A observação passa de 300 caracteres.",
    ]);
  });
});
