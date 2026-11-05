import { describe, expect, it } from "vitest";
import { motivoParaNaoComparar, problemasDaFotoNova } from "./comparacao.ts";
import type { ResumoDaFoto } from "./resumo.ts";

const ANTERIOR: ResumoDaFoto = {
  versaoDoEsquema: 17,
  geradaEm: "2026-11-05T08:30",
  representantes: ["1401", "1402"],
  notaMaisRecente: "2026-11-04",
  linhas: { foto: 1, representante: 2, cliente: 3_320, pedido_aberto: 51 },
  impressaoDigital: "anterior",
};

function nova(mudanca: Partial<ResumoDaFoto> = {}): ResumoDaFoto {
  return { ...ANTERIOR, geradaEm: "2026-11-05T09:00", ...mudanca };
}

function comLinhas(linhas: Record<string, number>): ResumoDaFoto {
  return nova({ linhas: { ...ANTERIOR.linhas, ...linhas } });
}

describe("problemasDaFotoNova", () => {
  it("aceita a foto que mudou pouco", () => {
    expect(problemasDaFotoNova(comLinhas({ cliente: 3_300 }), ANTERIOR)).toEqual([]);
  });

  it("recusa a tabela que encolheu mais da metade", () => {
    expect(problemasDaFotoNova(comLinhas({ cliente: 1_600 }), ANTERIOR)).toEqual(["cliente: de 3.320 para 1.600 linhas (−52%)"]);
  });

  it("recusa a tabela que cresceu mais da metade", () => {
    expect(problemasDaFotoNova(comLinhas({ cliente: 5_000 }), ANTERIOR)).toEqual(["cliente: de 3.320 para 5.000 linhas (+51%)"]);
  });

  it("aceita a mudança de exatamente 50%", () => {
    expect(problemasDaFotoNova(comLinhas({ cliente: 1_660 }), ANTERIOR)).toEqual([]);
  });

  it("recusa a tabela grande que sumiu da foto nova", () => {
    const { cliente: _, ...semCliente } = ANTERIOR.linhas;
    expect(problemasDaFotoNova(nova({ linhas: semCliente }), ANTERIOR)).toEqual(["cliente: de 3.320 para 0 linhas (−100%)"]);
  });

  it("não compara tabela pequena, que muda muito de uma carga para a outra", () => {
    expect(problemasDaFotoNova(comLinhas({ pedido_aberto: 10 }), ANTERIOR)).toEqual([]);
  });

  it("recusa a foto gerada antes da anterior", () => {
    expect(problemasDaFotoNova(nova({ geradaEm: "2026-11-05T08:00" }), ANTERIOR)).toEqual([
      "o relógio do Oracle voltou: a foto anterior é de 2026-11-05T08:30, e esta de 2026-11-05T08:00",
    ]);
  });

  it("recusa a foto cuja nota mais recente é mais antiga que a da anterior", () => {
    expect(problemasDaFotoNova(nova({ notaMaisRecente: "2026-10-01" }), ANTERIOR)).toEqual([
      "a nota mais recente voltou de 2026-11-04 para 2026-10-01: o extrator está lendo o banco de produção?",
    ]);
  });

  it("recusa a foto que veio sem nota quando a anterior tinha", () => {
    expect(problemasDaFotoNova(nova({ notaMaisRecente: null }), ANTERIOR)).toHaveLength(1);
  });

  it("junta todos os problemas, para quem rodou o extrator ver tudo de uma vez", () => {
    expect(problemasDaFotoNova(nova({ geradaEm: "2026-11-05T08:00", linhas: { ...ANTERIOR.linhas, cliente: 10 } }), ANTERIOR)).toHaveLength(2);
  });
});

describe("motivoParaNaoComparar", () => {
  it("compara fotos da mesma versão e com os mesmos representantes", () => {
    expect(motivoParaNaoComparar(nova(), ANTERIOR)).toBeNull();
  });

  it("não compara com a foto de outra versão do esquema, que tem outras tabelas", () => {
    expect(motivoParaNaoComparar(nova({ versaoDoEsquema: 18 }), ANTERIOR)).toBe("a anterior é da versão 17 do esquema, e esta da 18");
  });

  it("não compara quando a lista de autorizados mudou, porque o volume muda de propósito", () => {
    expect(motivoParaNaoComparar(nova({ representantes: ["1401", "1402", "1500"] }), ANTERIOR)).toBe("a lista de representantes autorizados mudou");
  });
});
