import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { impressaoDigital } from "./impressaoDigital.ts";

type Venda = [representante: string, mes: string, faturado: number];

const VENDAS: Venda[] = [
  ["1401", "2026-09", 340_232.63],
  ["1401", "2026-10", 99.4],
  ["1402", "2026-10", 1_500],
];

/** Uma foto pequena: o cabeçalho e as vendas por mês, na ordem dada. */
function fotoCom({ geradaEm = "2026-11-05T08:30", dataRef = "2026-11-05", vendas = VENDAS }: { geradaEm?: string; dataRef?: string; vendas?: Venda[] } = {}): string {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE foto (versao_esquema INTEGER, gerada_em TEXT, data_ref TEXT); CREATE TABLE painel_historico (representante TEXT, mes TEXT, faturado REAL);");
  db.prepare("INSERT INTO foto VALUES (17, ?, ?)").run(geradaEm, dataRef);
  const inserir = db.prepare("INSERT INTO painel_historico VALUES (?, ?, ?)");
  for (const venda of vendas) inserir.run(...venda);
  const impressao = impressaoDigital(db);
  db.close();
  return impressao;
}

describe("impressaoDigital", () => {
  it("sai igual quando só a hora da foto muda", () => {
    expect(fotoCom({ geradaEm: "2026-11-05T09:00" })).toBe(fotoCom());
  });

  it("sai igual com as linhas noutra ordem", () => {
    expect(fotoCom({ vendas: [...VENDAS].reverse() })).toBe(fotoCom());
  });

  it("sai igual quando a soma só muda o último algarismo", () => {
    const resto = VENDAS.slice(1);
    expect(fotoCom({ vendas: [["1401", "2026-09", 340_232.62999999995], ...resto] })).toBe(fotoCom({ vendas: [["1401", "2026-09", 340_232.63000000006], ...resto] }));
  });

  it("muda com um centavo de diferença", () => {
    expect(fotoCom({ vendas: VENDAS.map(([representante, mes, faturado]): Venda => [representante, mes, faturado === 99.4 ? 99.41 : faturado]) })).not.toBe(fotoCom());
  });

  it("muda na virada do dia, para a foto nova sair com a data de hoje", () => {
    expect(fotoCom({ dataRef: "2026-11-06" })).not.toBe(fotoCom());
  });

  it("muda quando some uma linha", () => {
    expect(fotoCom({ vendas: VENDAS.slice(1) })).not.toBe(fotoCom());
  });
});
