import { beforeEach, describe, expect, it } from "vitest";
import { abrirBancoDoApp } from "../bancoDoApp.ts";
import { consultarConvite } from "../login/convites.ts";
import { entrarComo } from "../login/loginDeTeste.ts";
import { usarSessao } from "../login/sessoes.ts";
import { listarUsuarios, UsuarioRecusado } from "../login/usuarios.ts";
import { ComandoRecusado, convidar, desativar, listar, novoConvite, revogar, type Contexto } from "./comandos.ts";

const AGORA = new Date("2026-10-15T12:00:00.000Z");
let contexto: Contexto;

beforeEach(() => {
  contexto = { banco: abrirBancoDoApp(":memory:"), origem: "https://crm.suprens.com.br", autorizados: () => new Set(["1401", "1402", "9999"]), agora: AGORA };
});

/** O token do link do convite que o comando escreveu. */
function tokenDo(texto: string): string {
  return /\/convite#([A-Za-z0-9_-]{43})/.exec(texto)?.[1] ?? "";
}

describe("convidar", () => {
  it("cria o login com os códigos e escreve o link do convite, com a validade em Brasília", () => {
    const texto = convidar(contexto, { nome: "Star Vendas", codigos: ["1402", "1401"] });
    expect(texto).toMatch(/com os códigos 1401, 1402/);
    expect(texto).toContain("até 17/10/2026 às 09:00 (Brasília)");
    expect(consultarConvite(contexto.banco, tokenDo(texto), AGORA)).toMatchObject({ estado: "valido", nome: "Star Vendas" });
  });

  it("recusa código fora da lista de autorizados da foto", () => {
    expect(() => convidar(contexto, { nome: "Outra", codigos: ["1401", "5555"] })).toThrow(UsuarioRecusado);
    expect(listarUsuarios(contexto.banco)).toEqual([]);
  });

  it("recusa código que já está em outro login ativo", () => {
    convidar(contexto, { nome: "Star Vendas", codigos: ["1401"] });
    expect(() => convidar(contexto, { nome: "Outra", codigos: ["1401"] })).toThrow(/já ligado a outro login ativo: 1401/);
  });

  it("registra a criação do login e do convite na auditoria", () => {
    convidar(contexto, { nome: "Star Vendas", codigos: ["1401"] });
    const eventos = contexto.banco.prepare("SELECT usuario, evento FROM auditoria ORDER BY id").all();
    expect(eventos).toEqual([
      { usuario: "linha-de-comando", evento: "usuario_criado" },
      { usuario: "linha-de-comando", evento: "convite_criado" },
    ]);
  });
});

describe("novo convite, revogar e desativar", () => {
  it("o convite novo troca o anterior que não foi usado", () => {
    const primeiro = tokenDo(convidar(contexto, { nome: "Star Vendas", codigos: ["1401"] }));
    const [usuario] = listarUsuarios(contexto.banco);
    const segundo = tokenDo(novoConvite(contexto, usuario?.id ?? ""));
    expect(consultarConvite(contexto.banco, primeiro, AGORA).estado).toBe("trocado");
    expect(consultarConvite(contexto.banco, segundo, AGORA).estado).toBe("valido");
  });

  it("revogar encerra as sessões; o login continua, para receber um convite novo", () => {
    const cookie = entrarComo(contexto.banco, ["1401"], AGORA);
    const [usuario] = listarUsuarios(contexto.banco);
    expect(revogar(contexto, usuario?.id ?? "")).toMatch(/^1 chave\(s\) de Teste 1401 revogada/);
    expect(usarSessao(contexto.banco, cookie.split("=")[1] ?? "", AGORA)).toEqual({ sessao: null, motivo: "revogada" });
    expect(tokenDo(novoConvite(contexto, usuario?.id ?? ""))).not.toBe("");
  });

  it("desativar derruba a sessão e o convite, e libera os códigos para outro login", () => {
    const cookie = entrarComo(contexto.banco, ["1401"], AGORA);
    const [usuario] = listarUsuarios(contexto.banco);
    const convite = tokenDo(novoConvite(contexto, usuario?.id ?? ""));
    desativar(contexto, usuario?.id ?? "");
    expect(usarSessao(contexto.banco, cookie.split("=")[1] ?? "", AGORA)).toEqual({ sessao: null, motivo: "revogada" });
    expect(consultarConvite(contexto.banco, convite, AGORA).estado).toBe("invalido");
    expect(() => novoConvite(contexto, usuario?.id ?? "")).toThrow(ComandoRecusado);
    expect(convidar(contexto, { nome: "Nova representação", codigos: ["1401"] })).toMatch(/^Login criado/);
  });

  it("lista os logins com os códigos e as chaves", () => {
    entrarComo(contexto.banco, ["1401", "1402"], AGORA);
    expect(listar(contexto)).toMatch(/^Teste 1401 e 1402 \([0-9a-f]{16}\), ativo, códigos 1401, 1402\n {2}- Chave de acesso, criada em 15\/10\/2026 às 09:00$/);
  });

  it("recusa o id que não existe, com o caminho para achar o certo", () => {
    expect(() => revogar(contexto, "nao-existe")).toThrow(/npm run admin -- usuarios/);
  });
});
