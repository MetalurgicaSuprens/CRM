import { describe, expect, it } from "vitest";
import { deBase64Url, explicarErro, paraBase64Url } from "./chaveDeAcesso";

describe("base64url", () => {
  it("vai e volta sem perder byte, com os caracteres próprios da URL e sem o preenchimento", () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf, 0x00, 0x7e]);
    const texto = paraBase64Url(bytes.buffer);
    expect(texto).toBe("-_-_AH4");
    expect(new Uint8Array(deBase64Url(texto))).toEqual(bytes);
  });

  it("lê o texto de qualquer tamanho, que o servidor manda sem o '='", () => {
    for (const tamanho of [0, 1, 2, 3, 32]) {
      const bytes = Uint8Array.from({ length: tamanho }, (_, i) => (i * 37) % 256);
      expect(new Uint8Array(deBase64Url(paraBase64Url(bytes.buffer)))).toEqual(bytes);
    }
  });
});

describe("explicarErro", () => {
  it("diz que o pedido foi cancelado quando a pessoa fecha a janela da chave", () => {
    expect(explicarErro(new DOMException("", "NotAllowedError")).message).toMatch(/cancelado ou o tempo acabou/);
  });

  it("manda entrar pela tela de entrada quando o aparelho já tem a chave", () => {
    expect(explicarErro(new DOMException("", "InvalidStateError")).message).toMatch(/já tem uma chave do CRM/);
  });

  it("dá uma mensagem geral para o erro desconhecido, sem o detalhe técnico", () => {
    expect(explicarErro(new Error("CBOR inválido")).message).toBe("A chave de acesso não funcionou neste aparelho. Tente de novo.");
  });
});
