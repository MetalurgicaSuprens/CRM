import { describe, expect, it } from "vitest";
import { criarLimitador } from "./limite.ts";

describe("criarLimitador", () => {
  it("deixa passar até o máximo na janela e recusa o resto", () => {
    const limitador = criarLimitador({ maximo: 3, janelaMs: 1_000 }, () => 0);
    expect([1, 2, 3, 4].map(() => limitador.permitir("ip"))).toEqual([true, true, true, false]);
  });

  it("conta cada chave separada", () => {
    const limitador = criarLimitador({ maximo: 1, janelaMs: 1_000 }, () => 0);
    expect([limitador.permitir("a"), limitador.permitir("b"), limitador.permitir("a")]).toEqual([true, true, false]);
  });

  it("recomeça a conta quando a janela acaba", () => {
    let agora = 0;
    const limitador = criarLimitador({ maximo: 1, janelaMs: 1_000 }, () => agora);
    limitador.permitir("ip");
    expect(limitador.permitir("ip")).toBe(false);
    agora = 1_000;
    expect(limitador.permitir("ip")).toBe(true);
  });
});
