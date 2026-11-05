import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { abrirBancoDoApp, emTransacao } from "./bancoDoApp.ts";

let pasta: string | null = null;

afterEach(() => {
  const apagar = pasta;
  pasta = null;
  if (apagar) fs.rmSync(apagar, { recursive: true, force: true });
});

function arquivoNovo(): string {
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), "crm-app-"));
  return path.join(pasta, "dados", "app.db");
}

describe("abrirBancoDoApp", () => {
  it("cria a pasta e o arquivo, aplica as migrações e não as repete ao abrir de novo", () => {
    const arquivo = arquivoNovo();
    abrirBancoDoApp(arquivo).close();
    const banco = abrirBancoDoApp(arquivo);
    expect(banco.prepare("PRAGMA user_version").get()?.user_version).toBe(4);
    expect(banco.prepare("PRAGMA journal_mode").get()?.journal_mode).toBe("wal");
    expect(banco.prepare("PRAGMA foreign_keys").get()?.foreign_keys).toBe(1);
    banco.close();
  });

  it("recusa o app.db de uma versão mais nova que a do servidor", () => {
    const arquivo = arquivoNovo();
    const banco = abrirBancoDoApp(arquivo);
    banco.exec("PRAGMA user_version = 99");
    banco.close();
    expect(() => abrirBancoDoApp(arquivo)).toThrow(/versão 99/);
  });
});

describe("emTransacao", () => {
  it("desfaz tudo quando um passo falha", () => {
    const banco = abrirBancoDoApp(":memory:");
    expect(() =>
      emTransacao(banco, () => {
        banco.prepare("INSERT INTO auditoria (momento, evento, resultado) VALUES ('x', 'saida', 'ok')").run();
        throw new Error("falhou");
      }),
    ).toThrow("falhou");
    expect(banco.prepare("SELECT COUNT(*) AS quantos FROM auditoria").get()?.quantos).toBe(0);
  });
});
