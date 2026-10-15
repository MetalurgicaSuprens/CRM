import { describe, expect, it } from "vitest";
import { statusDoCadastro } from "./carteira.ts";

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
