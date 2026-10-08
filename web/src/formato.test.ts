import { describe, expect, it } from "vitest";
import {
  diasEntre,
  formatarCompacto,
  formatarData,
  formatarMesAno,
  formatarPeriodo,
  formatarReais,
  formatarReaisCompacto,
  formatarTempoDesde,
  formatarVariacao,
} from "./formato";

const espacoFixo = (texto: string) => texto.replace(/ /g, " ");

describe("formatarReais", () => {
  it("mostra reais sem centavos", () => {
    expect(espacoFixo(formatarReais(182_340.67))).toBe("R$ 182.341");
  });

  it("usa o sinal de menos tipográfico", () => {
    expect(espacoFixo(formatarReais(-1_500))).toBe("−R$ 1.500");
  });
});

describe("formatarReaisCompacto", () => {
  it("abrevia milhares e milhões", () => {
    expect(formatarReaisCompacto(950)).toBe("R$ 950");
    expect(formatarReaisCompacto(48_520)).toBe("R$ 48,5 mil");
    expect(formatarReaisCompacto(182_340)).toBe("R$ 182 mil");
    expect(formatarReaisCompacto(1_234_000)).toBe("R$ 1,2 mi");
  });

  it("não mostra 1.000 mil na virada para milhão", () => {
    expect(formatarCompacto(999_600)).toBe("1 mi");
    expect(formatarCompacto(99_970)).toBe("100 mil");
  });
});

describe("formatarPeriodo", () => {
  it("mostra o ano só no fim quando os meses são do mesmo ano", () => {
    expect(formatarPeriodo("2026-04", "2026-09")).toBe("abr–set/26");
  });

  it("mostra os dois anos quando o período vira o ano", () => {
    expect(formatarPeriodo("2025-11", "2026-04")).toBe("nov/25–abr/26");
  });
});

describe("formatarVariacao", () => {
  it("arredonda para inteiro e mostra o sinal", () => {
    expect(formatarVariacao(0.083)).toBe("+8%");
    expect(formatarVariacao(-0.237)).toBe("−24%");
  });

  it("usa uma casa abaixo de 1% e zero sem sinal", () => {
    expect(formatarVariacao(0.004)).toBe("+0,4%");
    expect(formatarVariacao(0.0001)).toBe("0%");
  });
});

describe("datas", () => {
  it("formata sem deslocar o dia por fuso", () => {
    expect(formatarData("2026-10-07")).toBe("07/10/2026");
    expect(formatarMesAno("2025-01")).toBe("jan/25");
  });

  it("conta dias entre datas de calendário", () => {
    expect(diasEntre("2026-09-30", "2026-10-07")).toBe(7);
    expect(diasEntre("2025-10-07", "2026-10-07")).toBe(365);
  });

  it("descreve o tempo desde a última compra", () => {
    expect(formatarTempoDesde("2026-10-07", "2026-10-07")).toBe("hoje");
    expect(formatarTempoDesde("2026-10-06", "2026-10-07")).toBe("ontem");
    expect(formatarTempoDesde("2026-09-25", "2026-10-07")).toBe("há 12 dias");
    expect(formatarTempoDesde("2026-06-07", "2026-10-07")).toBe("há 4 meses");
    expect(formatarTempoDesde("2024-09-01", "2026-10-07")).toBe("há mais de 2 anos");
  });
});
