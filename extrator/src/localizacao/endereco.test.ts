import { describe, expect, it } from "vitest";
import { cepDoErp, chaveDaRua, isCepDaCidadeToda, separarNumero } from "./endereco.ts";

describe("separarNumero", () => {
  it("tira o número logo depois da vírgula e deixa o complemento de fora", () => {
    expect(separarNumero("R XV DE NOVEMBRO, 1200 SALA 3")).toEqual({ rua: "R XV DE NOVEMBRO", numero: 1200 });
    expect(separarNumero("AV BRASIL, 45-47")).toEqual({ rua: "AV BRASIL", numero: 45 });
    expect(separarNumero("RUA DAS FLORES, Nº 88")).toEqual({ rua: "RUA DAS FLORES", numero: 88 });
  });

  it("o número no nome da rua não é o da casa", () => {
    expect(separarNumero("RUA 7 DE SETEMBRO, 450")).toEqual({ rua: "RUA 7 DE SETEMBRO", numero: 450 });
    expect(separarNumero("RUA 7 DE SETEMBRO")).toEqual({ rua: "RUA 7 DE SETEMBRO", numero: null });
  });

  it("sem número: S/N e quilômetro de rodovia", () => {
    expect(separarNumero("ROD BR 116, S/N, KM 12")).toEqual({ rua: "ROD BR 116", numero: null });
    expect(separarNumero("ROD PR 445, KM 9")).toEqual({ rua: "ROD PR 445", numero: null });
  });
});

describe("chaveDaRua", () => {
  it("o ERP abreviado e o CNEFE por extenso dão a mesma chave", () => {
    expect(chaveDaRua("AV. DR. JOÃO DA SILVA")).toBe("JOAO SILVA");
    expect(chaveDaRua("AVENIDA DOUTOR JOAO DA SILVA")).toBe("JOAO SILVA");
  });

  it("tipo e título só caem no começo, e um nome que é só título fica", () => {
    expect(chaveDaRua("RUA SAO PEDRO")).toBe("SAO PEDRO");
    expect(chaveDaRua("RUA D")).toBe("D");
  });
});

describe("cepDoErp", () => {
  it("devolve o zero da esquerda que o ERP perde", () => {
    expect(cepDoErp(1310100)).toBe("01310100");
    expect(cepDoErp(85010000)).toBe("85010000");
  });

  it("CEP fora do formato fica sem CEP", () => {
    expect(cepDoErp(0)).toBeNull();
    expect(cepDoErp(123)).toBeNull();
    expect(cepDoErp(null)).toBeNull();
  });
});

describe("isCepDaCidadeToda", () => {
  it("o CEP terminado em 000 é o da cidade toda", () => {
    expect(isCepDaCidadeToda("85640000")).toBe(true);
    expect(isCepDaCidadeToda("85010010")).toBe(false);
  });
});
