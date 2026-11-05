import { describe, expect, it } from "vitest";
import type { ClienteDaCarteira, PrecoDoCliente, TabelaDoCliente } from "../erp/tipos.ts";
import { escolherTabela, formatarMedida, montarCatalogo } from "./catalogo.ts";

function tabela(parcial: Partial<TabelaDoCliente>): TabelaDoCliente {
  return { cliente: 1, tabela: "PDR02", papel: "PRINCIPAL", nome: "PADRAO - FEV", moeda: "REAL", situacao: "ATIVO", ...parcial };
}

function cliente(numero: number, mercado: ClienteDaCarteira["mercado"] = "PRACA"): ClienteDaCarteira {
  return {
    chave: `1/${numero}`,
    empresa: 1,
    cliente: numero,
    isPessoaFisica: false,
    fantasia: `CLIENTE ${numero}`,
    razaoSocial: `CLIENTE ${numero} LTDA`,
    cidade: "CAMPINAS",
    uf: "SP",
    municipio: "3509502",
    endereco: null,
    ponto: null,
    mercado,
    representante: "1401",
    status: "ativo",
    grupo: null,
  };
}

function preco(clienteNumero: number, produto: string, precoCento: number, tabelaCodigo = "PDR02"): PrecoDoCliente {
  return { cliente: clienteNumero, tabela: tabelaCodigo, produto, precoCento };
}

describe("escolherTabela", () => {
  it("fica com a principal", () => {
    const principal = tabela({ tabela: "B", papel: "PRINCIPAL" });
    expect(escolherTabela([tabela({ tabela: "A", papel: "SECUNDARIA" }), principal], "PRACA")).toBe(principal);
  });

  it("sem principal, fica com a que não é secundária", () => {
    const semPapel = tabela({ tabela: "B", papel: null });
    expect(escolherTabela([tabela({ tabela: "A", papel: "SECUNDARIA" }), semPapel], "PRACA")).toBe(semPapel);
  });

  it("só aceita tabela em real, porque a tela mostra R$", () => {
    expect(escolherTabela([tabela({ moeda: "DOLAR" })], "EXPORTACAO")).toBeNull();
  });

  it("na montadora, não aceita tabela obsoleta, como o SGI; na praça, aceita", () => {
    expect(escolherTabela([tabela({ situacao: "OBSOLETO" })], "MONTADORA")).toBeNull();
    expect(escolherTabela([tabela({ situacao: "OBSOLETO" })], "PRACA")).not.toBeNull();
  });
});

describe("montarCatalogo", () => {
  const catalogo = montarCatalogo(
    [
      { id: "id-1", cliente: cliente(1) },
      { id: "id-2", cliente: cliente(2) },
      { id: "id-3", cliente: cliente(3) },
      { id: "id-4", cliente: cliente(4) },
    ],
    {
      tabelas: [tabela({ cliente: 1 }), tabela({ cliente: 2 }), tabela({ cliente: 3 }), tabela({ cliente: 4, moeda: "DOLAR" })],
      precos: [
        // Os clientes 1 e 2 têm o mesmo desconto; o 3 tem desconto próprio no FAB.
        preco(1, "FAB1422P", 76),
        preco(1, "MAB1216P", 50),
        preco(2, "MAB1216P", 50),
        preco(2, "FAB1422P", 76),
        preco(3, "FAB1422P", 70),
        preco(3, "MAB1216P", 50),
        // Preço de outra tabela do cliente 1, que não é a escolhida.
        preco(1, "FAB1422P", 99, "MMC"),
      ],
      partNumbers: [
        { produto: "MAB1216P", partNumber: "5U0-123" },
        { produto: "FAB1422P", partNumber: "N906227" },
        { produto: "FAB1422P", partNumber: "51234567" },
        // Repetido em duas tabelas de montadora.
        { produto: "FAB1422P", partNumber: "N906227" },
        { produto: "FORA-DAS-LISTAS", partNumber: "999" },
      ],
      produtosDasTabelas: [
        { produto: "FAB1422P", familia: "FLEXIL", medidaMinimaMm: 14, medidaMaximaMm: 22, embalagem: 100 },
        { produto: "MAB1216P", familia: null, medidaMinimaMm: null, medidaMaximaMm: null, embalagem: 500 },
        { produto: "FORA-DAS-LISTAS", familia: "MOLA", medidaMinimaMm: null, medidaMaximaMm: null, embalagem: 10 },
      ],
      jaComprados: [
        { chave: "1/1", produto: "FAB1422P", ultimaCompra: { data: "2026-09-15", precoCento: 78.4 } },
        { chave: "1/1", produto: "PRODUTO-FORA-DA-LISTA", ultimaCompra: null },
        // Só bonificação, sem valor: comprou, mas sem preço.
        { chave: "1/2", produto: "MAB1216P", ultimaCompra: null },
      ],
    },
  );

  it("dá aos clientes de preços iguais a mesma lista, e uma lista nova a quem tem desconto diferente", () => {
    expect(catalogo.porCliente.get("id-1")).toEqual({ tabela: "PADRAO - FEV", lista: 1 });
    expect(catalogo.porCliente.get("id-2")).toEqual({ tabela: "PADRAO - FEV", lista: 1 });
    expect(catalogo.porCliente.get("id-3")?.lista).toBe(2);
    expect(catalogo.lista_de_precos).toHaveLength(4);
  });

  it("deixa sem catálogo o cliente sem tabela usável", () => {
    expect(catalogo.porCliente.has("id-4")).toBe(false);
  });

  it("usa só os preços da tabela escolhida", () => {
    expect(catalogo.lista_de_precos.filter(({ lista }) => lista === 1).map(({ produto, preco_cento }) => [produto, preco_cento])).toEqual([
      ["FAB1422P", 76],
      ["MAB1216P", 50],
    ]);
  });

  it("marca como já comprado só o que está na lista do cliente, com a última compra que tem preço", () => {
    expect(catalogo.produto_comprado).toEqual([
      { cliente: "id-1", produto: "FAB1422P", ultima_compra: "2026-09-15", preco_cento_na_ultima: 78.4 },
      { cliente: "id-2", produto: "MAB1216P", ultima_compra: null, preco_cento_na_ultima: null },
    ]);
  });

  it("leva os part numbers da Bíblia só dos produtos de alguma lista, sem repetir, em ordem", () => {
    expect(catalogo.produto_part_number).toEqual([
      { produto: "FAB1422P", part_number: "51234567" },
      { produto: "FAB1422P", part_number: "N906227" },
      { produto: "MAB1216P", part_number: "5U0-123" },
    ]);
  });

  it("leva a família, a medida e a embalagem só dos produtos de alguma lista", () => {
    expect(catalogo.produtos).toEqual([
      { produto: "FAB1422P", familia: "FLEXIL", medida: "14–22 mm", embalagem: 100 },
      { produto: "MAB1216P", familia: "SEM FAMÍLIA", medida: null, embalagem: 500 },
    ]);
  });
});

describe("formatarMedida", () => {
  it("mostra a faixa de aperto em mm, com vírgula decimal", () => {
    expect(formatarMedida(8.5, 12)).toBe("8,5–12 mm");
  });

  it("não mostra medida quando falta uma das pontas", () => {
    expect(formatarMedida(null, 22)).toBeNull();
  });
});
