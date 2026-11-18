import { describe, expect, it } from "vitest";
import { eixoRedondo, escalarAltura, tetoComCorte } from "./escala";

describe("eixoRedondo", () => {
  it("escolhe passos redondos e um teto que cobre o maior valor", () => {
    expect(eixoRedondo(183_000)).toEqual({ maximo: 200_000, marcas: [0, 50_000, 100_000, 150_000, 200_000] });
    expect(eixoRedondo(9_200).marcas).toEqual([0, 2_500, 5_000, 7_500, 10_000]);
  });

  it("devolve um eixo mínimo quando não há valores", () => {
    expect(eixoRedondo(0)).toEqual({ maximo: 1, marcas: [0, 1] });
  });
});

describe("escalarAltura", () => {
  it("é proporcional e nunca negativa", () => {
    expect(escalarAltura(50, 200, 240)).toBe(60);
    expect(escalarAltura(-10, 200, 240)).toBe(0);
  });
});

describe("tetoComCorte", () => {
  it("vai até a barra mais alta quando ela não passa de 2,5 vezes a maior média", () => {
    expect(tetoComCorte([80, 150, 120], [100, 110])).toBe(150);
  });

  it("corta em 2,5 vezes a maior média o mês de pedido grande, para a linha não achatar", () => {
    expect(tetoComCorte([80, 900, 120], [100, 110])).toBe(275);
  });

  it("nunca fica abaixo da maior média, e sem média vai até a barra mais alta", () => {
    expect(tetoComCorte([10, 20], [100])).toBe(100);
    expect(tetoComCorte([10, 20], [0])).toBe(20);
  });
});
