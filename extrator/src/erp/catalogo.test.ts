import { describe, expect, it } from "vitest";
import type { Oracle } from "../oracle.ts";
import { lerPrecos, lerPrecosDoCliente } from "./catalogo.ts";

/** Um Oracle que só guarda o SQL que recebeu. */
function oracleQueGuarda(): { oracle: Oracle; consultas: string[] } {
  const consultas: string[] = [];
  return {
    consultas,
    oracle: {
      consultar: (sql) => {
        consultas.push(sql);
        return Promise.resolve([]);
      },
      fechar: () => Promise.resolve(),
    },
  };
}

describe("preços do catálogo", () => {
  it("só traz o produto liberado para representante, na foto e na conferência do pedido, como o SGI6R", async () => {
    const { oracle, consultas } = oracleQueGuarda();
    await lerPrecos(oracle, { inicioDaJanela: "2023-11-01" } as never, ["1401"]);
    await lerPrecosDoCliente(oracle, 123456, ["F-100"]);
    expect(consultas).toHaveLength(2);
    for (const sql of consultas) expect(sql).toContain("TRIM(V.VIEW_IPR) = 'SIM'");
  });
});
