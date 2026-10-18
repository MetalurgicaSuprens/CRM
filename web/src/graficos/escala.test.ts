import { describe, expect, it } from "vitest";
import { eixoRedondo, escalarAltura, passoNaRampa } from "./escala";

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

describe("passoNaRampa", () => {
  it("dá 0 ao zero e divide o resto em 5 faixas iguais até o maior", () => {
    expect(passoNaRampa(0, 1_000)).toBe(0);
    expect(passoNaRampa(1, 1_000)).toBe(1);
    expect(passoNaRampa(200, 1_000)).toBe(1);
    expect(passoNaRampa(201, 1_000)).toBe(2);
    expect(passoNaRampa(1_000, 1_000)).toBe(5);
  });
});
