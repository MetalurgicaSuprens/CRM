import { describe, expect, it } from "vitest";
import { AVISO_DE_PEDIDO_BLOQUEADO, podeReceberPedido } from "./statusDoCadastro.ts";

describe("podeReceberPedido", () => {
  it("aceita só o cliente ativo no cadastro", () => {
    expect(podeReceberPedido("ativo")).toBe(true);
  });

  it("bloqueia o inativo e o substituído, que continuam na carteira", () => {
    expect(podeReceberPedido("inativo")).toBe(false);
    expect(podeReceberPedido("substituido")).toBe(false);
  });
});

describe("AVISO_DE_PEDIDO_BLOQUEADO", () => {
  it("manda o representante falar com a equipe de vendas da Suprens", () => {
    expect(AVISO_DE_PEDIDO_BLOQUEADO.inativo).toMatch(/equipe de vendas da Suprens e peça a reativação/);
    expect(AVISO_DE_PEDIDO_BLOQUEADO.substituido).toMatch(/substituído por outro código.*equipe de vendas da Suprens/);
  });
});
