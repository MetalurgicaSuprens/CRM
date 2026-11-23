import { describe, expect, it } from "vitest";
import type { DadosDoPedidoDoErp } from "../erp/tipos.ts";
import { formatarDocumento, formatarTelefone, montarTabelasDoPedido, somarEscolhas } from "./dadosDoPedido.ts";

const ID = (chave: string) => (chave === "2/10" ? "id-do-10" : null);

function dados(mudancas: Partial<DadosDoPedidoDoErp> = {}): DadosDoPedidoDoErp {
  return {
    cadastros: [],
    locais: [],
    transportadoras: [],
    condicoes: [],
    escolhas: [],
    transportadorasDosRepresentantes: [],
    ultimosPedidos: [],
    ...mudancas,
  };
}

describe("formatarDocumento", () => {
  it("põe de volta os zeros da esquerda do CNPJ, que o número do ERP perde", () => {
    expect(formatarDocumento("1116500000140")).toBe("01.116.500/0001-40");
    expect(formatarDocumento("11538974000140")).toBe("11.538.974/0001-40");
  });

  it("formata o CPF da pessoa física", () => {
    expect(formatarDocumento("12345678901", true)).toBe("123.456.789-01");
  });

  it("formata como CNPJ o documento da empresa, mesmo curto", () => {
    expect(formatarDocumento("1234567890", false)).toBe("00.001.234/5678-90");
  });
});

describe("formatarTelefone", () => {
  it("separa o DDD e os últimos quatro dígitos", () => {
    expect(formatarTelefone(98, 98467193)).toBe("(98) 9846-7193");
    expect(formatarTelefone(41, 998765432)).toBe("(41) 99876-5432");
  });

  it("é null sem número", () => {
    expect(formatarTelefone(41, 0)).toBeNull();
  });
});

describe("somarEscolhas", () => {
  it("soma os pedidos de cada escolha, com os nomes do CRM, e deixa de fora o cliente fora da carteira", () => {
    const escolhas = [
      { chave: "2/10", transportadora: "101", condicao: "1002", classificacao: "COMERCIALIZACAO", freteParcial: "NAO ACEITA FRETE PARCIAL", isComItemDaOrdemDeCompra: true, pedidos: 8 },
      { chave: "2/10", transportadora: "101", condicao: "1010", classificacao: "USO/CONSUMO", freteParcial: "ACEITA FRETE PARCIAL", isComItemDaOrdemDeCompra: false, pedidos: 2 },
      { chave: "2/99", transportadora: "555", condicao: "1002", classificacao: "COMERCIALIZACAO", freteParcial: null, isComItemDaOrdemDeCompra: false, pedidos: 5 },
    ];
    expect(somarEscolhas(escolhas, ID)).toEqual([
      { cliente: "id-do-10", tipo: "transportadora", valor: "101", pedidos: 10 },
      { cliente: "id-do-10", tipo: "condicao", valor: "1002", pedidos: 8 },
      { cliente: "id-do-10", tipo: "classificacao", valor: "comercializacao", pedidos: 8 },
      { cliente: "id-do-10", tipo: "parcial", valor: "nao", pedidos: 8 },
      { cliente: "id-do-10", tipo: "xped", valor: "sim", pedidos: 8 },
      { cliente: "id-do-10", tipo: "condicao", valor: "1010", pedidos: 2 },
      { cliente: "id-do-10", tipo: "classificacao", valor: "uso_consumo", pedidos: 2 },
      { cliente: "id-do-10", tipo: "parcial", valor: "sim", pedidos: 2 },
      { cliente: "id-do-10", tipo: "xped", valor: "nao", pedidos: 2 },
    ]);
  });
});

describe("montarTabelasDoPedido", () => {
  it("dá o nome de quem retira ao código da retirada e usa o fantasia nas outras transportadoras", () => {
    const transportadoras = [
      { codigo: "78499999", fantasia: "R E T I R A -", razaoSocial: "RETIRA", documento: "", cidade: "", uf: "" },
      { codigo: "101", fantasia: null, razaoSocial: "TRANSPORTES  IPE LTDA", documento: "11222333000181", cidade: "CURITIBA", uf: "PR" },
    ];
    const tabelas = montarTabelasDoPedido(dados({ transportadoras }), [], new Set(), ID);
    expect(tabelas.transportadora.map(({ nome, cnpj }) => [nome, cnpj])).toEqual([
      ["Cliente retira", ""],
      ["TRANSPORTES IPE LTDA", "11.222.333/0001-81"],
    ]);
  });

  it("numera os itens do último pedido de cada cliente e liga o dia ao cadastro", () => {
    const cadastro = {
      chave: "2/10",
      isPessoaFisica: false,
      documento: "11538974000140",
      inscricaoEstadual: "123259029",
      suframa: null,
      ddd: 98,
      telefone: 98467193,
      emailDoXml: "NFE@CLIENTE.COM.BR",
      endereco: "RODOVIA  MA230, 101",
      bairro: "AEROPORTO",
      cep: 65525000,
      condicaoDePagamento: "1002",
      isBaseDoIpi: true,
    };
    const ultimosPedidos = [
      { chave: "2/10", dia: "2026-10-01", produto: "A", pecas: 500 },
      { chave: "2/10", dia: "2026-10-01", produto: "B", pecas: 300 },
    ];
    const tabelas = montarTabelasDoPedido(dados({ cadastros: [cadastro], ultimosPedidos }), [], new Set(), ID);
    expect(tabelas.ultimo_pedido_item).toEqual([
      { cliente: "id-do-10", ordem: 1, produto: "A", pecas: 500 },
      { cliente: "id-do-10", ordem: 2, produto: "B", pecas: 300 },
    ]);
    expect(tabelas.cliente_cadastro[0]).toMatchObject({
      documento: "11.538.974/0001-40",
      telefone: "(98) 9846-7193",
      email_xml: "nfe@cliente.com.br",
      endereco: "RODOVIA MA230, 101",
      cep: "65525000",
      base_ipi: 1,
      ultimo_pedido_em: "2026-10-01",
    });
  });

  it("leva o IPI só dos produtos de alguma lista, uma alíquota por produto", () => {
    const precos = [
      { cliente: 10, tabela: "T", produto: "A", precoCento: 10, aliquotaIpi: 5 },
      { cliente: 11, tabela: "T", produto: "A", precoCento: 11, aliquotaIpi: 5 },
      { cliente: 10, tabela: "T", produto: "FORA", precoCento: 10, aliquotaIpi: 9.75 },
    ];
    expect(montarTabelasDoPedido(dados(), precos, new Set(["A"]), ID).produto_ipi).toEqual([{ produto: "A", aliquota: 5 }]);
  });
});
