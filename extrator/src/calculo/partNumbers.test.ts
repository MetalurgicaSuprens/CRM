import { describe, expect, it } from "vitest";
import { montarPartNumbersDosClientes, partNumbersDoItem } from "./partNumbers.ts";

describe("partNumbersDoItem", () => {
  it("sugere o part number da tabela própria quando ela tem um só", () => {
    expect(partNumbersDoItem(["01853"], null)).toEqual({ opcoes: ["01853"], sugerido: "01853" });
  });

  it("com mais de um na tabela, sugere o último que o cliente usou entre eles", () => {
    expect(partNumbersDoItem(["1171563", "2RD121255"], "2RD121255")).toEqual({ opcoes: ["1171563", "2RD121255"], sugerido: "2RD121255" });
  });

  it("com mais de um na tabela e nenhum usado, não sugere: o representante escolhe", () => {
    expect(partNumbersDoItem(["1171563", "2RD121255"], null).sugerido).toBeNull();
    expect(partNumbersDoItem(["1171563", "2RD121255"], "OUTRO")).toEqual({ opcoes: ["1171563", "2RD121255", "OUTRO"], sugerido: null });
  });

  it("sem part number na tabela, sugere o último que o cliente usou", () => {
    expect(partNumbersDoItem([], "232.407-9RF")).toEqual({ opcoes: ["232.407-9RF"], sugerido: "232.407-9RF" });
  });

  it("sem tabela e sem uso, não tem part number", () => {
    expect(partNumbersDoItem([], null)).toEqual({ opcoes: [], sugerido: null });
  });
});

describe("montarPartNumbersDosClientes", () => {
  const produtos = new Set(["MAB1216P", "FAB1422P", "TIAM5258"]);

  it("ignora o part number das tabelas gerais e fica só com o que o cliente usou", () => {
    const linhas = montarPartNumbersDosClientes([{ id: "id-1", chave: "1/1", tabela: "PDR02", produtos }], {
      daTabela: [{ tabela: "PDR02", produto: "TIAM5258", partNumber: "1171563" }],
      usados: [{ chave: "1/1", produto: "MAB1216P", partNumber: "01853" }],
    });
    expect(linhas).toEqual([{ cliente: "id-1", produto: "MAB1216P", part_number: "01853", is_sugerido: 1 }]);
  });

  it("traz o part number da tabela própria, só dos produtos da lista do cliente", () => {
    const linhas = montarPartNumbersDosClientes([{ id: "id-2", chave: "1/2", tabela: "JAC", produtos }], {
      daTabela: [
        { tabela: "JAC", produto: "FAB1422P", partNumber: "N906227" },
        { tabela: "JAC", produto: "FORA-DA-LISTA", partNumber: "999" },
        { tabela: "OUTRA", produto: "MAB1216P", partNumber: "555" },
      ],
      usados: [],
    });
    expect(linhas).toEqual([{ cliente: "id-2", produto: "FAB1422P", part_number: "N906227", is_sugerido: 1 }]);
  });

  it("dá as opções da tabela sem sugerir quando há mais de uma e o cliente não usou nenhuma", () => {
    const linhas = montarPartNumbersDosClientes([{ id: "id-3", chave: "1/3", tabela: "JAC", produtos }], {
      daTabela: [
        { tabela: "JAC", produto: "TIAM5258", partNumber: "1171563" },
        { tabela: "JAC", produto: "TIAM5258", partNumber: "2RD121255" },
      ],
      usados: [{ chave: "1/9", produto: "TIAM5258", partNumber: "2RD121255" }],
    });
    expect(linhas.map(({ part_number, is_sugerido }) => [part_number, is_sugerido])).toEqual([
      ["1171563", 0],
      ["2RD121255", 0],
    ]);
  });
});
