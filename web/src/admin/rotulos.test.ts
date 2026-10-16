import { describe, expect, it } from "vitest";
import { descreverCodigos, formatarQuando, rotuloDoEvento, situacaoDaSessao } from "./rotulos";

const AGORA = new Date("2026-10-16T15:00:00.000Z");

describe("formatarQuando", () => {
  it("mostra o momento em Brasília, como hoje, ontem ou a data", () => {
    expect(formatarQuando("2026-10-16T12:15:00.000Z", AGORA)).toBe("hoje, 09:15");
    expect(formatarQuando("2026-10-15T23:30:00.000Z", AGORA)).toBe("ontem, 20:30");
    expect(formatarQuando("2026-10-14T12:15:00.000Z", AGORA)).toBe("14/10 às 09:15");
  });

  it("vira o dia pelo relógio de Brasília, não pelo UTC", () => {
    expect(formatarQuando("2026-10-16T02:30:00.000Z", AGORA)).toBe("ontem, 23:30");
  });
});

describe("rótulos", () => {
  it("dá nome ao evento e deixa o desconhecido como veio", () => {
    expect(rotuloDoEvento("chave_revogada")).toBe("Chave bloqueada");
    expect(rotuloDoEvento("evento_novo")).toBe("evento_novo");
  });

  it("diz se a sessão está aberta ou por que terminou; a que venceu sozinha, sem motivo, venceu", () => {
    expect(situacaoDaSessao({ aberta: true, motivo: null })).toBe("Aberta");
    expect(situacaoDaSessao({ aberta: false, motivo: "encerrada" })).toBe("Encerrada pela administração");
    expect(situacaoDaSessao({ aberta: false, motivo: null })).toBe("Venceu");
  });

  it("descreve os códigos com o nome do ERP, quando a foto tem", () => {
    expect(descreverCodigos([{ codigo: "1401", nome: "STAR VENDAS" }, { codigo: "1402", nome: null }])).toBe("1401 · STAR VENDAS, 1402");
  });
});
