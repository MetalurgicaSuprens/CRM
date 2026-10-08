import { describe, expect, it } from "vitest";
import type { Mercado } from "./tipos";
import { sugerirMix, type ClienteNoMix } from "./mix";

function cliente(codigo: string, faturamento12m: number, familias: string[] = [], mercado: Mercado = "PRACA"): ClienteNoMix {
  return { codigo, mercado, faturamento12m, familias12m: new Set(familias), familias24m: new Set(familias) };
}

/** `quantos` clientes com faturamentos a partir de `inicio`; os `compram` primeiros compram a família. */
function grupo(prefixo: string, quantos: number, inicio: number, familia: string, compram: number, mercado: Mercado = "PRACA") {
  return Array.from({ length: quantos }, (_, i) => cliente(`${prefixo}${i}`, inicio + i * 1_000, i < compram ? [familia] : [], mercado));
}

describe("sugerirMix", () => {
  it("compara com os clientes do mesmo mercado e da mesma faixa de porte", () => {
    const alvo = cliente("alvo", 115_000);
    const pequenos = grupo("p", 30, 1_000, "PRESIL", 0);
    const medios = grupo("m", 29, 100_000, "PRESIL", 18);
    const grandes = grupo("g", 30, 500_000, "PRESIL", 30);

    const sugestao = sugerirMix(alvo, [alvo, ...pequenos, ...medios, ...grandes]);

    expect(sugestao?.porte).toBe("medio");
    expect(sugestao?.oportunidades).toEqual([{ familia: "PRESIL", penetracao: 18 / 29 }]);
  });

  it("usa o mercado inteiro quando a faixa de porte tem menos de 20 clientes", () => {
    const alvo = cliente("alvo", 50_000, [], "MONTADORA");
    const montadoras = grupo("m", 39, 10_000, "MICRO", 30, "MONTADORA");

    const sugestao = sugerirMix(alvo, [alvo, ...montadoras, ...grupo("p", 90, 1_000, "PRESIL", 90)]);

    expect(sugestao?.porte).toBeNull();
    expect(sugestao?.oportunidades).toEqual([{ familia: "MICRO", penetracao: 30 / 39 }]);
  });

  it("não compara quando o mercado tem menos de 20 clientes ativos", () => {
    const alvo = cliente("alvo", 50_000, [], "EXPORTACAO");
    const ativos = grupo("a", 19, 10_000, "FLEXIL", 19, "EXPORTACAO");
    const semCompraEm12Meses = grupo("s", 10, 0, "FLEXIL", 10, "EXPORTACAO").map((outro) => ({ ...outro, faturamento12m: 0 }));

    expect(sugerirMix(alvo, [alvo, ...ativos, ...semCompraEm12Meses])).toBeNull();
  });

  it("não sugere família que o cliente comprou nos últimos 24 meses", () => {
    const alvo = { ...cliente("alvo", 10_000), familias24m: new Set(["FLEXIL"]) };

    const sugestao = sugerirMix(alvo, [alvo, ...grupo("o", 20, 10_000, "FLEXIL", 20)]);

    expect(sugestao?.oportunidades).toEqual([]);
  });

  it("sugere só a família que pelo menos metade dos parecidos compra, da mais comum para a menos comum", () => {
    const alvo = cliente("alvo", 10_000);
    const parecidos = Array.from({ length: 20 }, (_, i) => {
      const familias = [i < 16 ? "ZIP" : "", i < 10 ? "TIGRE" : "", i < 9 ? "MOLA" : ""].filter(Boolean);
      return cliente(`o${i}`, 10_000, familias);
    });

    const sugestao = sugerirMix(alvo, [alvo, ...parecidos]);

    expect(sugestao?.oportunidades.map((oportunidade) => oportunidade.familia)).toEqual(["ZIP", "TIGRE"]);
  });
});
