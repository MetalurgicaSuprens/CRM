import { describe, expect, it } from "vitest";
import { correspondeAoCliente, correspondeAoClienteOuCidade } from "./busca";

const EMPRESA = { nome: "Retífica São Jorge", codigoErp: "591328580003", cidade: "Ribeirão Preto" };
/** CNPJ 01.116.500/0001-xx: o código do ERP perdeu o zero da esquerda. */
const COM_ZERO_NA_RAIZ = { nome: "Master Borrachas", codigoErp: "11165000001", cidade: "Goiânia" };
const PESSOA_FISICA = { nome: "Rogério Tavares", codigoErp: null, cidade: "Bauru" };

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
});
