import { describe, expect, it } from "vitest";
import { arredondarAoCentavo, pecasEmCentos, primeiraEntregaPossivel, totalDoPedido, valorDaLinha } from "./pedido.ts";

describe("pecasEmCentos", () => {
  it("converte peças em CT, o cento do ERP", () => {
    expect(pecasEmCentos(250)).toBe(2.5);
  });
});

describe("valorDaLinha e totalDoPedido", () => {
  it("cobra o preço do cento pela quantidade em centos", () => {
    expect(valorDaLinha({ quantidade: 250, precoCento: 120 })).toBe(300);
  });

  it("soma as linhas", () => {
    expect(totalDoPedido([{ quantidade: 200, precoCento: 95 }, { quantidade: 50, precoCento: 260 }])).toBe(320);
  });

  it("arredonda cada linha ao centavo", () => {
    expect(valorDaLinha({ quantidade: 333, precoCento: 12.35 })).toBe(41.13);
  });

  it("soma as linhas como a tela as mostra, no centavo", () => {
    // Sem arredondar cada linha, 41,1255 + 41,1255 daria R$ 82,25, e a tela mostraria 41,13 + 41,13.
    expect(totalDoPedido([{ quantidade: 333, precoCento: 12.35 }, { quantidade: 333, precoCento: 12.35 }])).toBe(82.26);
  });
});

describe("arredondarAoCentavo", () => {
  it("fica com duas casas", () => {
    expect(arredondarAoCentavo(123.456)).toBe(123.46);
    expect(arredondarAoCentavo(0.004)).toBe(0);
  });
});

describe("primeiraEntregaPossivel", () => {
  it("fica 5 dias úteis depois de hoje", () => {
    expect(primeiraEntregaPossivel("2026-11-05")).toBe("2026-11-12");
  });

  it("não conta o feriado no caminho", () => {
    // Da quinta 08/10/2026: sexta 9, o 12 é feriado, e terça 13 a sexta 16.
    expect(primeiraEntregaPossivel("2026-10-08")).toBe("2026-10-16");
  });
});
