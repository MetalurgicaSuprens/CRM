import { describe, expect, it } from "vitest";
import { grupoDigitado, municipioDoCadastro, statusDoCadastro } from "./carteira.ts";

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

describe("grupoDigitado", () => {
  const digitados = new Set(["OVD", "MORELATE"]);

  it("traz o grupo que alguém digitou no SGI", () => {
    expect(grupoDigitado("OVD", digitados)).toBe("OVD");
  });

  it("deixa sem grupo o nome fantasia que a tela grava com o campo vazio", () => {
    expect(grupoDigitado("CASA DOS PARAFUSOS", digitados)).toBeNull();
    expect(grupoDigitado(null, digitados)).toBeNull();
  });

  it("junta os espaços repetidos, como no nome fantasia", () => {
    expect(grupoDigitado("MORELATE ", new Set(["MORELATE"]))).toBe("MORELATE");
    expect(grupoDigitado("NORTE  COM", new Set(["NORTE COM"]))).toBe("NORTE COM");
  });
});
