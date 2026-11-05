import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { abrirBancoDoApp } from "./bancoDoApp.ts";
import { apagarRegistrosAntigos } from "./limpeza.ts";
import { criarConvite } from "./login/convites.ts";
import { entrarComo } from "./login/loginDeTeste.ts";
import { criarUsuario } from "./login/usuarios.ts";

const AGORA = new Date("2026-11-05T12:00:00.000Z");
const HA_13_MESES = new Date("2025-10-05T12:00:00.000Z");
const HA_11_MESES = new Date("2025-12-05T12:00:00.000Z");

let banco: DatabaseSync;

beforeEach(() => {
  banco = abrirBancoDoApp(":memory:");
});

function registrarEm(momento: Date): void {
  banco.prepare("INSERT INTO auditoria (momento, usuario, evento, alvo, resultado) VALUES (?, NULL, 'entrada', NULL, 'ok')").run(momento.toISOString());
}

function momentosDo(sql: string): string[] {
  return banco
    .prepare(sql)
    .all()
    .map((linha) => String(Object.values(linha)[0]));
}

describe("apagarRegistrosAntigos", () => {
  it("apaga do registro o que passou de 12 meses e guarda o resto", () => {
    registrarEm(HA_13_MESES);
    registrarEm(HA_11_MESES);

    expect(apagarRegistrosAntigos(banco, AGORA).registro).toBe(1);
    expect(momentosDo("SELECT momento FROM auditoria WHERE evento = 'entrada'")).toEqual([HA_11_MESES.toISOString()]);
  });

  it("apaga a sessão sem uso há mais de 12 meses", () => {
    entrarComo(banco, ["1401"], HA_13_MESES);
    entrarComo(banco, ["1402"], HA_11_MESES);

    expect(apagarRegistrosAntigos(banco, AGORA).sessoes).toBe(1);
    expect(momentosDo("SELECT ultimo_uso FROM sessoes")).toEqual([HA_11_MESES.toISOString()]);
  });

  it("apaga o convite vencido há mais de 12 meses e guarda o que ainda vale", () => {
    const usuario = criarUsuario(banco, { nome: "Star Vendas", codigos: ["1401"], autorizados: new Set(["1401"]), ligadoPor: "teste" }, HA_13_MESES);
    criarConvite(banco, { usuario: usuario.id, criadoPor: "teste" }, HA_13_MESES);
    criarConvite(banco, { usuario: usuario.id, criadoPor: "teste" }, AGORA);

    expect(apagarRegistrosAntigos(banco, AGORA).convites).toBe(1);
    expect(momentosDo("SELECT criado_em FROM convites")).toEqual([AGORA.toISOString()]);
  });

  it("registra a limpeza no próprio registro, com quanto apagou", () => {
    registrarEm(HA_13_MESES);

    apagarRegistrosAntigos(banco, AGORA);
    expect(banco.prepare("SELECT evento, resultado FROM auditoria ORDER BY id DESC LIMIT 1").get()).toEqual({
      evento: "registros_apagados",
      resultado: "1 do registro, 0 sessões e 0 convites, de mais de 12 meses",
    });
  });

  it("não registra nada quando não há o que apagar", () => {
    registrarEm(HA_11_MESES);

    expect(apagarRegistrosAntigos(banco, AGORA)).toEqual({ registro: 0, sessoes: 0, convites: 0 });
    expect(momentosDo("SELECT evento FROM auditoria")).toEqual(["entrada"]);
  });
});
