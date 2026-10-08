import { describe, expect, it } from "vitest";
import {
  classificarSituacao,
  entradaRecente,
  mudancaDeRitmo,
  parouDeComprar,
  perdaMensal,
  type HistoricoDoCliente,
} from "./analises";

const HOJE = "2026-10-08";

function historico(parcial: Partial<HistoricoDoCliente> = {}): HistoricoDoCliente {
  return {
    mensal: Array.from({ length: 24 }, () => ({ valor: 1_000, pecas: 500 })),
    compras: ["2026-09-20"],
    primeiraCompra: "2015-01-10",
    cicloDias: 30,
    temPedidoEmAberto: false,
    ...parcial,
  };
}

/** 24 meses fechados; os 6 do ano anterior e os 6 últimos com os valores e peças pedidos. */
function semestres(antes: { valor: number; pecas: number }, agora: { valor: number; pecas: number }) {
  return Array.from({ length: 24 }, (_, i) => (i >= 18 ? agora : i >= 6 && i < 12 ? antes : { valor: 1_000, pecas: 500 }));
}

describe("parouDeComprar", () => {
  it("vale para quem passou do dobro do ciclo sem comprar", () => {
    expect(parouDeComprar(historico({ cicloDias: 30, compras: ["2026-07-30"] }), HOJE)).toBe(true);
    expect(parouDeComprar(historico({ cicloDias: 45, compras: ["2026-07-30"] }), HOJE)).toBe(false);
  });

  it("espera pelo menos 60 dias, mesmo com ciclo curto", () => {
    expect(parouDeComprar(historico({ cicloDias: 20, compras: ["2026-08-19"] }), HOJE)).toBe(false);
    expect(parouDeComprar(historico({ cicloDias: 20, compras: ["2026-08-08"] }), HOJE)).toBe(true);
  });

  it("dá 180 dias ao cliente irregular", () => {
    expect(parouDeComprar(historico({ cicloDias: null, compras: ["2026-04-21"] }), HOJE)).toBe(false);
    expect(parouDeComprar(historico({ cicloDias: null, compras: ["2026-04-01"] }), HOJE)).toBe(true);
  });

  it("não conta quem tem pedido em aberto", () => {
    expect(parouDeComprar(historico({ compras: ["2026-06-01"], temPedidoEmAberto: true }), HOJE)).toBe(false);
  });

  it("depois de 24 meses sem compra, o cliente é inativo e não parado", () => {
    const antigo = historico({ compras: ["2024-08-01"] });
    expect(parouDeComprar(antigo, HOJE)).toBe(false);
    expect(classificarSituacao(antigo, HOJE)).toBe("inativo");
  });
});

describe("perdaMensal", () => {
  it("é a média dos 12 meses até a última compra", () => {
    const mensal = Array.from({ length: 24 }, (_, i) => ({ valor: i <= 17 ? 1_200 : 0, pecas: 0 }));
    expect(perdaMensal(historico({ mensal }))).toBe(1_200);
  });
});

describe("mudancaDeRitmo", () => {
  it("compara os últimos 6 meses fechados com os mesmos 6 do ano anterior", () => {
    const ritmo = mudancaDeRitmo(historico({ mensal: semestres({ valor: 1_000, pecas: 500 }, { valor: 600, pecas: 300 }) }));
    expect(ritmo).toMatchObject({ direcao: "menos", semestre: 3_600, semestreAnoAnterior: 6_000 });
    expect(ritmo?.variacao).toBeCloseTo(-0.4);
  });

  it("mostra a variação em peças, que separa o reajuste de preço", () => {
    const ritmo = mudancaDeRitmo(historico({ mensal: semestres({ valor: 1_000, pecas: 500 }, { valor: 1_400, pecas: 500 }) }));
    expect(ritmo?.direcao).toBe("mais");
    expect(ritmo?.variacaoPecas).toBe(0);
  });

  it("ignora variação menor que 20%", () => {
    expect(mudancaDeRitmo(historico({ mensal: semestres({ valor: 1_000, pecas: 500 }, { valor: 850, pecas: 425 }) }))).toBeNull();
  });

  it("ignora diferença menor que R$ 2 mil, mesmo com variação grande", () => {
    expect(mudancaDeRitmo(historico({ mensal: semestres({ valor: 600, pecas: 300 }, { valor: 350, pecas: 175 }) }))).toBeNull();
  });

  it("exige base de R$ 3 mil no ano anterior", () => {
    expect(mudancaDeRitmo(historico({ mensal: semestres({ valor: 450, pecas: 225 }, { valor: 1_500, pecas: 750 }) }))).toBeNull();
  });

  it("exige 3 compras nos dois períodos", () => {
    const mensal = semestres({ valor: 0, pecas: 0 }, { valor: 0, pecas: 0 });
    mensal[6] = { valor: 9_000, pecas: 4_500 };
    mensal[23] = { valor: 2_000, pecas: 1_000 };
    expect(mudancaDeRitmo(historico({ mensal }))).toBeNull();
  });

  it("deixa em risco quem está comprando menos", () => {
    const caindo = historico({ mensal: semestres({ valor: 1_000, pecas: 500 }, { valor: 600, pecas: 300 }) });
    expect(classificarSituacao(caindo, HOJE)).toBe("em_risco");
  });
});

describe("entradaRecente", () => {
  it("chama de novo quem fez a primeira compra nos últimos 12 meses", () => {
    expect(entradaRecente(historico({ primeiraCompra: "2026-02-10", compras: ["2026-02-10", "2026-09-01"] }), HOJE)).toEqual({
      tipo: "novo",
      desde: "2026-02-10",
    });
  });

  it("chama de reativado quem voltou nos últimos 12 meses depois de um ano ou mais sem comprar", () => {
    const compras = ["2024-03-10", "2024-04-15", "2025-11-20", "2026-01-15", "2026-03-02"];
    expect(entradaRecente(historico({ compras }), HOJE)).toEqual({ tipo: "reativado", desde: "2025-11-20" });
  });

  it("não marca quem compra sem interrupção", () => {
    expect(entradaRecente(historico({ compras: ["2026-07-01", "2026-08-01", "2026-09-01"] }), HOJE)).toBeNull();
  });
});
