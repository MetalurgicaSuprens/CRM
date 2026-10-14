import { describe, expect, it } from "vitest";
import {
  formatarCodigoDoCliente,
  formatarCodigosDoRepresentante,
  formatarCompacto,
  formatarContagem,
  formatarData,
  formatarDiaPorExtenso,
  formatarMesAno,
  formatarMomento,
  formatarPedidosDaNota,
  formatarPeriodo,
  formatarPrazo,
  formatarSemestres,
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

describe("formatarContagem", () => {
  it("usa o singular só para um", () => {
    expect(formatarContagem(1, "cliente", "clientes")).toBe("1 cliente");
    expect(formatarContagem(0, "cliente", "clientes")).toBe("0 clientes");
    expect(formatarContagem(1_200, "peça", "peças")).toBe("1.200 peças");
  });
});

describe("formatarPrazo", () => {
  it("fala do futuro em linguagem de conversa", () => {
    expect(formatarPrazo("2026-10-08", "2026-10-08")).toBe("hoje");
    expect(formatarPrazo("2026-10-09", "2026-10-08")).toBe("amanhã");
    expect(formatarPrazo("2026-10-20", "2026-10-08")).toBe("em 12 dias");
    expect(formatarPrazo("2027-01-08", "2026-10-08")).toBe("em 3 meses");
  });
});

describe("formatarMomento", () => {
  it("usa hoje e ontem com a hora", () => {
    expect(formatarMomento("2026-10-08T16:42", "2026-10-08T17:00")).toBe("hoje, 16:42");
    expect(formatarMomento("2026-10-07T09:05", "2026-10-08T17:00")).toBe("ontem, 09:05");
  });

  it("decide o hoje pelo relógio: a foto de ontem não aparece como de hoje", () => {
    expect(formatarMomento("2026-10-08T23:50", "2026-10-09T09:15")).toBe("ontem, 23:50");
  });

  it("mostra dia e mês no mesmo ano, e o ano quando muda", () => {
    expect(formatarMomento("2026-10-01T15:10", "2026-10-08T17:00")).toBe("01/10 às 15:10");
    expect(formatarMomento("2025-12-30T08:00", "2026-01-05T17:00")).toBe("30/12/2025 às 08:00");
  });
});

describe("formatarDiaPorExtenso", () => {
  it("escreve o dia da semana com inicial maiúscula, o dia e o mês", () => {
    expect(formatarDiaPorExtenso("2026-10-09")).toBe("Sexta-feira, 9 de outubro");
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

  it("descreve o tempo desde a última compra", () => {
    expect(formatarTempoDesde("2026-10-07", "2026-10-07")).toBe("hoje");
    expect(formatarTempoDesde("2026-10-06", "2026-10-07")).toBe("ontem");
    expect(formatarTempoDesde("2026-09-25", "2026-10-07")).toBe("há 12 dias");
    expect(formatarTempoDesde("2026-06-07", "2026-10-07")).toBe("há 4 meses");
    expect(formatarTempoDesde("2024-09-01", "2026-10-07")).toBe("há mais de 2 anos");
  });
});

describe("formatarCodigosDoRepresentante", () => {
  it("usa o singular com um código só", () => {
    expect(formatarCodigosDoRepresentante(["1401"])).toBe("Representante 1401");
  });

  it("junta os códigos do mesmo login com vírgula e 'e'", () => {
    expect(formatarCodigosDoRepresentante(["1118", "1119"])).toBe("Representantes 1118 e 1119");
    expect(formatarCodigosDoRepresentante(["1118", "1119", "1120"])).toBe("Representantes 1118, 1119 e 1120");
  });
});

describe("formatarSemestres", () => {
  it("dá o semestre das análises e o mesmo do ano anterior", () => {
    expect(formatarSemestres({ inicio: "2026-04", fim: "2026-09" })).toEqual({ atual: "abr–set/26", anterior: "abr–set/25" });
  });

  it("põe o ano nos dois meses quando o semestre vira o ano", () => {
    expect(formatarSemestres({ inicio: "2025-11", fim: "2026-04" })).toEqual({ atual: "nov/25–abr/26", anterior: "nov/24–abr/25" });
  });
});

describe("formatarPedidosDaNota", () => {
  it("usa o singular com um pedido só e junta vários com vírgula e 'e'", () => {
    expect(formatarPedidosDaNota(["1801234"])).toBe("Pedido 1801234");
    expect(formatarPedidosDaNota(["1801234", "1801240"])).toBe("Pedidos 1801234 e 1801240");
  });
});

describe("formatarCodigoDoCliente", () => {
  it("mostra o código do ERP da empresa", () => {
    expect(formatarCodigoDoCliente("123456780001")).toBe("123456780001");
  });

  it("mostra a pessoa física sem código, porque o código dela no ERP é o CPF", () => {
    expect(formatarCodigoDoCliente(null)).toBe("Pessoa física");
  });
});
