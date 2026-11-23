import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ARQUIVO_DA_TRAVA, travar } from "./trava.ts";

let pasta: string;

beforeEach(() => {
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), "crm-trava-"));
});

afterEach(() => {
  fs.rmSync(pasta, { recursive: true, force: true });
});

describe("travar", () => {
  it("deixa uma passada por vez e libera quando ela solta", () => {
    const primeira = travar(pasta);
    expect(primeira).not.toBeNull();
    expect(travar(pasta)).toBeNull();
    primeira?.soltar();
    expect(travar(pasta)).not.toBeNull();
  });

  it("vence a trava de uma passada que morreu há mais de 30 minutos", () => {
    travar(pasta);
    const daquiA31Minutos = fs.statSync(path.join(pasta, ARQUIVO_DA_TRAVA)).mtimeMs + 31 * 60_000;
    expect(travar(pasta, daquiA31Minutos)).not.toBeNull();
  });
});
