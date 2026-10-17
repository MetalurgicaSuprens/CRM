import { describe, expect, it } from "vitest";
import { somarMeses } from "dominio/datas";
import type { ClienteDaCarteira, DadosDoErp, DatasDeCompra, ProdutoDoCliente, VendaDoMes } from "../erp/tipos.ts";
import { montarClientes } from "./clientes.ts";
import { montarReferencia } from "./referencia.ts";

const referencia = montarReferencia("2026-10-13T09:50");
const ids = {
  doCliente: (cliente: ClienteDaCarteira) => `cliente-${cliente.cliente}`,
  doGrupo: (representante: string, nome: string) => `grupo-${representante}-${nome}`,
};

function cliente(numero: number, parcial: Partial<ClienteDaCarteira> = {}): ClienteDaCarteira {
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
    mercado: "PRACA",
    representante: "1302",
    status: "ativo",
    grupo: null,
    ...parcial,
  };
}

/** R$ 1.000 e 100 peças por mês, com uma nota no dia 15, de `primeiro` a `ultimo`. */
function comprasMensais(numero: number, primeiro: string, ultimo: string): { datas: DatasDeCompra; vendas: VendaDoMes[] } {
  const meses: string[] = [];
  for (let mes = primeiro; mes <= ultimo; mes = somarMeses(mes, 1)) meses.push(mes);
  return {
    datas: { primeiraCompra: `${primeiro}-15`, ultimaAntesDaJanela: null, datas: meses.map((mes) => `${mes}-15`) },
    vendas: meses.map((mes) => ({ chave: `1/${numero}`, mes, valor: 1_000, pecas: 100 })),
  };
}

function produto(numero: number, codigo: string, valor: number): ProdutoDoCliente {
  return { chave: `1/${numero}`, produto: codigo, familia: "FLEXIL", pecas: valor / 10, valor, ultimaCompra: "2026-09-15" };
}

/**
 * A OVD do 1302 tem duas filiais: Curitiba comprou até janeiro e parou, e a Bahia começou a comprar
 * em fevereiro, no lugar dela. A OVD Itajaí é do 1310, e o cliente 4 do 1302 não tem grupo.
 */
function dadosDaCarteira(): DadosDoErp {
  const compras = new Map([
    [1, comprasMensais(1, "2024-01", "2026-01")],
    [2, comprasMensais(2, "2026-02", "2026-09")],
    [3, comprasMensais(3, "2025-01", "2026-09")],
    [4, comprasMensais(4, "2024-01", "2026-09")],
  ]);
  return {
    geradaEm: referencia.geradaEm,
    representantes: new Map([
      ["1302", "PAVANI"],
      ["1310", "MARKA"],
    ]),
    carteira: [
      cliente(1, { fantasia: "OVD CURITIBA", grupo: "OVD" }),
      cliente(2, { fantasia: "OVD BAHIA", grupo: "OVD", cidade: "SALVADOR", uf: "BA" }),
      cliente(3, { fantasia: "OVD ITAJAI", grupo: "OVD", representante: "1310" }),
      cliente(4),
    ],
    vendasDoMes: [...compras.values()].flatMap(({ vendas }) => vendas),
    datasDeCompra: new Map([...compras.entries()].map(([numero, { datas }]) => [`1/${numero}`, datas])),
    familias: [],
    produtos: [produto(1, "F-100", 500), produto(2, "F-100", 600), produto(2, "P-200", 900), produto(4, "F-100", 300)],
    pedidos: [],
    pedidosFaturados: [],
    notas: [],
    vendasDoDia: [],
    tabelas: [],
    precos: [],
    produtosDasTabelas: [],
    jaComprados: [],
  };
}

describe("montarClientes: grupos do SGI", () => {
  const tabelas = montarClientes(dadosDaCarteira(), referencia, ids);
  const linha = (id: string) => tabelas.cliente.find((cliente) => cliente.cliente === id);

  it("junta os CNPJs do mesmo grupo e do mesmo representante numa linha só, com o nome do grupo", () => {
    expect(linha("grupo-1302-OVD")).toMatchObject({
      nome: "OVD",
      representante: "1302",
      codigo_erp: null,
      cidade: "",
      municipio_ibge: null,
      tabela_preco: null,
      cnpjs: 2,
      grupo: null,
    });
    expect(linha("cliente-1")?.grupo).toBe("grupo-1302-OVD");
    expect(linha("cliente-2")?.grupo).toBe("grupo-1302-OVD");
  });

  it("deixa fora do grupo o CNPJ de outro representante, que fica sozinho na carteira dele", () => {
    expect(linha("cliente-3")?.grupo).toBeNull();
    expect(tabelas.cliente.some((cliente) => cliente.cliente.startsWith("grupo-1310"))).toBe(false);
  });

  it("analisa o grupo pelas compras somadas: a compra que muda de filial não deixa o grupo parado", () => {
    expect(linha("cliente-1")?.situacao).toBe("parado");
    expect(linha("cliente-2")?.situacao).toBe("novo");
    expect(linha("grupo-1302-OVD")).toMatchObject({ situacao: "ativo", ultima_compra: "2026-09-15", cliente_desde: 2024 });
  });

  it("soma o faturado dos CNPJs nos 12 meses fechados e mês a mês", () => {
    // Curitiba: outubro a janeiro; Bahia: fevereiro a setembro.
    expect(linha("grupo-1302-OVD")?.faturamento_12m).toBe(12_000);
    expect(tabelas.cliente_mes.filter((mes) => mes.cliente === "grupo-1302-OVD" && mes.mes === "2026-09")).toEqual([
      { cliente: "grupo-1302-OVD", mes: "2026-09", valor: 1_000 },
    ]);
  });

  it("lista nas análises o grupo no lugar dos CNPJs, que guardam a própria situação", () => {
    const nasAnalises = [...tabelas.analise_parado, ...tabelas.analise_novo, ...tabelas.analise_ritmo].map(({ cliente }) => cliente);
    expect(nasAnalises).not.toContain("cliente-1");
    expect(nasAnalises).not.toContain("cliente-2");
    expect(tabelas.analise_parado).toEqual([]);
  });

  it("escolhe os produtos mais comprados do grupo pela soma dos CNPJs", () => {
    expect(tabelas.ficha_produto.filter(({ cliente }) => cliente === "grupo-1302-OVD")).toEqual([
      { cliente: "grupo-1302-OVD", produto: "F-100", pecas_12m: 110, valor_12m: 1_100, ultima_compra: "2026-09-15" },
      { cliente: "grupo-1302-OVD", produto: "P-200", pecas_12m: 90, valor_12m: 900, ultima_compra: "2026-09-15" },
    ]);
  });

  it("leva à ficha 60 meses fechados e o corrente: o gráfico de 48 meses com a média móvel de 12", () => {
    const meses = tabelas.cliente_mes.filter(({ cliente }) => cliente === "cliente-4");
    expect(meses).toHaveLength(61);
    expect(meses[0]).toEqual({ cliente: "cliente-4", mes: "2021-10", valor: 0 });
    expect(meses.at(-1)?.mes).toBe("2026-10");
  });

  it("não muda o cliente sem grupo", () => {
    expect(linha("cliente-4")).toMatchObject({ nome: "CLIENTE 4", grupo: null, cnpjs: null, situacao: "ativo" });
  });
});
