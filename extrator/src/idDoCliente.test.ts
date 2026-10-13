import { describe, expect, it } from "vitest";
import { idDoCliente } from "./idDoCliente.ts";

const CHAVE = Buffer.alloc(32, 7);

describe("idDoCliente", () => {
  it("é o mesmo para o mesmo cliente, foto após foto", () => {
    expect(idDoCliente(CHAVE, 20210001, 591328580003)).toBe(idDoCliente(CHAVE, 20210001, 591328580003));
  });

  it("muda de um cliente para outro e com outra chave", () => {
    const id = idDoCliente(CHAVE, 20210001, 591328580003);
    expect(idDoCliente(CHAVE, 20210001, 591328580004)).not.toBe(id);
    expect(idDoCliente(Buffer.alloc(32, 8), 20210001, 591328580003)).not.toBe(id);
  });

  it("tem 16 caracteres hexadecimais, sem o código do ERP", () => {
    const id = idDoCliente(CHAVE, 20210001, 591328580003);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(id).not.toContain("59132858");
  });
});
