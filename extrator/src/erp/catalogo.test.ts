import { describe, expect, it } from "vitest";
import { oracleDeTeste } from "../oracleDeTeste.ts";
import { lerPrecos, lerPrecosDoCliente } from "./catalogo.ts";

describe("preços do catálogo", () => {
  it("só traz o produto liberado para representante, na foto e na conferência do pedido, como o SGI6R", async () => {
    const oracle = oracleDeTeste();
    await lerPrecos(oracle, { inicioDaJanela: "2023-11-01" } as never, ["1401"]);
    await lerPrecosDoCliente(oracle, 123456, ["F-100"]);
    const consultas = oracle.chamadas.flatMap((chamada) => (chamada.tipo === "consulta" ? [chamada.sql] : []));
    expect(consultas).toHaveLength(2);
    for (const sql of consultas) expect(sql).toContain("TRIM(V.VIEW_IPR) = 'SIM'");
  });
});
