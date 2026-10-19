import { describe, expect, it } from "vitest";
import { enderecoDoCadastro, grupoDoCadastro, municipioDoCadastro, statusDoCadastro } from "./carteira.ts";

describe("statusDoCadastro", () => {
  it("traz os três status do SGI com os nomes do CRM", () => {
    expect(statusDoCadastro("ATIVO")).toBe("ativo");
    expect(statusDoCadastro("INATIVO")).toBe("inativo");
    expect(statusDoCadastro("SUBSTITUIDO")).toBe("substituido");
  });

  it("conta como ativo o cliente sem status, como o SGI", () => {
    expect(statusDoCadastro(null)).toBe("ativo");
  });

  it("para a foto com um status que o CRM não conhece", () => {
    expect(() => statusDoCadastro("BLOQUEADO")).toThrow(/Status de cliente desconhecido/);
  });
});

describe("municipioDoCadastro", () => {
  it("aceita o código IBGE de 7 dígitos do estado do cliente", () => {
    expect(municipioDoCadastro("5208707", "GO")).toBe("5208707");
  });

  it("deixa sem município o código de outro estado, curto ou vazio, e o cliente do exterior", () => {
    expect(municipioDoCadastro("3550308", "GO")).toBeNull();
    expect(municipioDoCadastro("520870", "GO")).toBeNull();
    expect(municipioDoCadastro(null, "GO")).toBeNull();
    expect(municipioDoCadastro("5208707", "EX")).toBeNull();
  });
});

describe("grupoDoCadastro", () => {
  it("traz o texto do campo, também quando é o nome fantasia que a tela grava com o campo vazio", () => {
    expect(grupoDoCadastro("VALMONT")).toBe("VALMONT");
    expect(grupoDoCadastro(null)).toBeNull();
  });

  it("junta os espaços repetidos, como no nome fantasia", () => {
    expect(grupoDoCadastro("MORELATE ")).toBe("MORELATE");
    expect(grupoDoCadastro("NORTE  COM")).toBe("NORTE COM");
  });
});

describe("enderecoDoCadastro", () => {
  it("junta os espaços do texto e do bairro e dá ao CEP o zero que o ERP perde", () => {
    expect(enderecoDoCadastro("R  XV DE NOVEMBRO, 1200 ", "CENTRO ", "1310100")).toEqual({ texto: "R XV DE NOVEMBRO, 1200", bairro: "CENTRO", cep: "01310100" });
  });

  it("sem a rua, fica sem endereço; sem bairro ou com CEP fora do formato, só sem eles", () => {
    expect(enderecoDoCadastro(null, "CENTRO", "85010100")).toBeNull();
    expect(enderecoDoCadastro("AV BRASIL, 10", null, "0")).toEqual({ texto: "AV BRASIL, 10", bairro: null, cep: null });
  });
});
