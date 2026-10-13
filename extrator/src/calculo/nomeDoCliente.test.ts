import { describe, expect, it } from "vitest";
import { nomeDoCliente } from "./nomeDoCliente.ts";

describe("nomeDoCliente", () => {
  it("usa o fantasia", () => {
    expect(nomeDoCliente("AUTO PECAS HORIZONTE", "HORIZONTE COMERCIO DE PECAS LTDA")).toBe("AUTO PECAS HORIZONTE");
  });

  it("usa a razão social quando não há fantasia", () => {
    expect(nomeDoCliente("", "HORIZONTE COMERCIO DE PECAS LTDA")).toBe("HORIZONTE COMERCIO DE PECAS LTDA");
  });

  it("usa a razão social quando o fantasia veio cortado em 25 caracteres", () => {
    expect(nomeDoCliente("DISTRIBUIDORA DE MANGUEIR", "DISTRIBUIDORA DE MANGUEIRAS VALE SUL LTDA")).toBe(
      "DISTRIBUIDORA DE MANGUEIRAS VALE SUL LTDA",
    );
  });
});
