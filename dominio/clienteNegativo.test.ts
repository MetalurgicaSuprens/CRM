import { describe, expect, it } from "vitest";
import { isClienteNegativo } from "./clienteNegativo.ts";

describe("isClienteNegativo", () => {
  it("não marca o cliente ATIVO no SGI, nem o que não tem linha de status, que o SGI trata como ATIVO", () => {
    expect(isClienteNegativo("ATIVO")).toBe(false);
    expect(isClienteNegativo(null)).toBe(false);
  });

  it("marca o cliente INATIVO ou SUBSTITUIDO no SGI", () => {
    expect(isClienteNegativo("INATIVO")).toBe(true);
    expect(isClienteNegativo("SUBSTITUIDO")).toBe(true);
  });
});
