import { describe, expect, it } from "vitest";
import { correspondeAoCliente, correspondeAoClienteOuCidade, correspondeAoProduto, partNumberDaBusca } from "./busca";

const EMPRESA = { nome: "Retífica São Jorge", codigoErp: "591328580003", cidade: "Ribeirão Preto", cnpjs: null };
/** CNPJ 01.116.500/0001-xx: o código do ERP perdeu o zero da esquerda. */
const COM_ZERO_NA_RAIZ = { nome: "Master Borrachas", codigoErp: "11165000001", cidade: "Goiânia", cnpjs: null };
const PESSOA_FISICA = { nome: "Rogério Tavares", codigoErp: null, cidade: "Bauru", cnpjs: null };

describe("correspondeAoCliente", () => {
  it("acha pelo nome, sem acento nem maiúscula", () => {
    expect(correspondeAoCliente(EMPRESA, "retifica sao")).toBe(true);
    expect(correspondeAoCliente(EMPRESA, "Borrachas")).toBe(false);
  });

  it("acha pelo CNPJ com ou sem pontuação, e com os dígitos verificadores, que o código do ERP não tem", () => {
    expect(correspondeAoCliente(EMPRESA, "59.132.858/0003-41")).toBe(true);
    expect(correspondeAoCliente(EMPRESA, "59132858000341")).toBe(true);
    expect(correspondeAoCliente(EMPRESA, "591328580003")).toBe(true);
  });

  it("acha por parte do CNPJ, como a raiz", () => {
    expect(correspondeAoCliente(EMPRESA, "59.132.858")).toBe(true);
    expect(correspondeAoCliente(EMPRESA, "12.345.678")).toBe(false);
  });

  it("acha o CNPJ que começa com zero, que o código do ERP perdeu", () => {
    expect(correspondeAoCliente(COM_ZERO_NA_RAIZ, "01.116.500/0001-90")).toBe(true);
    expect(correspondeAoCliente(COM_ZERO_NA_RAIZ, "0111650")).toBe(true);
  });

  it("não acha a pessoa física por número: ela não tem CNPJ, e o código dela é o CPF", () => {
    expect(correspondeAoCliente(PESSOA_FISICA, "123")).toBe(false);
    expect(correspondeAoCliente(PESSOA_FISICA, "rogerio")).toBe(true);
  });

  it("não procura no CNPJ quando a busca tem letras, mesmo com números", () => {
    expect(correspondeAoCliente(EMPRESA, "Jorge 3")).toBe(false);
  });

  it("mostra todos com a busca vazia", () => {
    expect(correspondeAoCliente(PESSOA_FISICA, "  ")).toBe(true);
  });
});

describe("correspondeAoClienteOuCidade", () => {
  it("acha também pela cidade", () => {
    expect(correspondeAoClienteOuCidade(EMPRESA, "ribeirao")).toBe(true);
    expect(correspondeAoClienteOuCidade(PESSOA_FISICA, "bauru")).toBe(true);
    expect(correspondeAoClienteOuCidade(PESSOA_FISICA, "campinas")).toBe(false);
  });

  it("acha o grupo pelo nome dele e pelo nome, pelo CNPJ ou pela cidade de um CNPJ dele", () => {
    const bahia = { nome: "OVD BAHIA", codigoErp: "123456780012", cidade: "Salvador", cnpjs: null };
    const grupo = { nome: "OVD", codigoErp: null, cidade: "", cnpjs: [bahia] };
    expect(correspondeAoClienteOuCidade(grupo, "ovd")).toBe(true);
    expect(correspondeAoClienteOuCidade(grupo, "bahia")).toBe(true);
    expect(correspondeAoClienteOuCidade(grupo, "12.345.678/0012")).toBe(true);
    expect(correspondeAoClienteOuCidade(grupo, "salvador")).toBe(true);
    expect(correspondeAoClienteOuCidade(grupo, "curitiba")).toBe(false);
  });
});

const PRODUTO = { codigo: "FAB1422P", familia: "FLEXIL", medida: "14–22 mm", partNumbers: ["N.906.227.01", "51234567"] };

describe("correspondeAoProduto", () => {
  it("acha pelo código, pela família e pela medida", () => {
    expect(correspondeAoProduto(PRODUTO, "fab14")).toBe(true);
    expect(correspondeAoProduto(PRODUTO, "flexil")).toBe(true);
    expect(correspondeAoProduto(PRODUTO, "14–22")).toBe(true);
  });

  it("acha por qualquer part number, com ou sem a pontuação", () => {
    expect(correspondeAoProduto(PRODUTO, "N90622701")).toBe(true);
    expect(correspondeAoProduto(PRODUTO, "906.227")).toBe(true);
    expect(correspondeAoProduto(PRODUTO, "5123")).toBe(true);
  });

  it("não acha o que o produto não tem", () => {
    expect(correspondeAoProduto(PRODUTO, "presil")).toBe(false);
    expect(correspondeAoProduto({ ...PRODUTO, partNumbers: [] }, "51234567")).toBe(false);
  });
});

describe("partNumberDaBusca", () => {
  it("devolve o part number que a busca achou, para a tela mostrar esse", () => {
    expect(partNumberDaBusca(PRODUTO.partNumbers, "5123")).toBe("51234567");
    expect(partNumberDaBusca(PRODUTO.partNumbers, "n 906")).toBe("N.906.227.01");
  });

  it("sem busca ou sem part number que case, devolve null", () => {
    expect(partNumberDaBusca(PRODUTO.partNumbers, "")).toBeNull();
    expect(partNumberDaBusca(PRODUTO.partNumbers, "--")).toBeNull();
    expect(partNumberDaBusca(PRODUTO.partNumbers, "777")).toBeNull();
  });
});
