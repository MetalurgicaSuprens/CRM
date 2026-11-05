import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Foto } from "dominio/esquemaDaFoto";
import { nomeDaFotoDoManifesto } from "dominio/manifestoDaFoto";
import { entregarFotoDeTeste, gravarFotoDeTeste, montarFotoDeTeste, type PastasDeTeste } from "../fotoDeTeste.ts";
import { criarFotoAtual, FotoIndisponivel, type FotoAtual } from "./fotoAtual.ts";

/** O servidor só olha a entrada de novo depois de meio minuto. */
const DEPOIS_DA_PROXIMA_CONFERENCIA = 30_000;

let pastas: PastasDeTeste;
let foto: FotoAtual;
let agora: number;

beforeEach(() => {
  pastas = gravarFotoDeTeste();
  agora = 0;
  foto = criarFotoAtual(pastas, () => agora);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  foto.fechar();
  vi.restoreAllMocks();
  fs.rmSync(pastas.raiz, { recursive: true, force: true });
});

function fotoGeradaEm(geradaEm: string): Foto {
  const original = montarFotoDeTeste();
  return { ...original, foto: { ...original.foto, gerada_em: geradaEm } };
}

function geradaEmDaFotoEmUso(): unknown {
  return foto.abrir().prepare("SELECT gerada_em FROM foto").get()?.gerada_em;
}

function esperarAProximaConferencia(): void {
  agora += DEPOIS_DA_PROXIMA_CONFERENCIA;
}

describe("criarFotoAtual", () => {
  it("usa a foto que chegou com manifesto", () => {
    expect(geradaEmDaFotoEmUso()).toBe("2026-10-13T09:55");
  });

  it("não usa a foto que chegou sem manifesto", () => {
    for (const nome of fs.readdirSync(pastas.entrada).filter((nome) => nomeDaFotoDoManifesto(nome))) fs.rmSync(path.join(pastas.entrada, nome));

    expect(() => foto.abrir()).toThrow(FotoIndisponivel);
  });

  it("troca pela foto mais nova quando ela chega e passa na conferência", () => {
    foto.abrir();
    entregarFotoDeTeste(pastas.entrada, fotoGeradaEm("2026-10-13T10:30"));
    esperarAProximaConferencia();

    expect(geradaEmDaFotoEmUso()).toBe("2026-10-13T10:30");
  });

  it("continua com a foto em uso quando a nova é recusada, e diz no log por quê", () => {
    foto.abrir();
    entregarFotoDeTeste(pastas.entrada, fotoGeradaEm("2026-10-13T10:30"), (manifesto) => ({ ...manifesto, sha256: "0".repeat(64) }));
    esperarAProximaConferencia();

    expect(geradaEmDaFotoEmUso()).toBe("2026-10-13T09:55");
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/recusada: o sha256 da cópia não bate/));
  });

  it("fica com a mais nova das que passam na conferência", () => {
    foto.abrir();
    entregarFotoDeTeste(pastas.entrada, fotoGeradaEm("2026-10-13T10:30"));
    entregarFotoDeTeste(pastas.entrada, fotoGeradaEm("2026-10-13T11:00"), (manifesto) => ({ ...manifesto, tamanho: 1 }));
    esperarAProximaConferencia();

    expect(geradaEmDaFotoEmUso()).toBe("2026-10-13T10:30");
  });

  it("continua com a cópia conferida mesmo que a foto suma da entrada", () => {
    foto.abrir();
    fs.rmSync(pastas.entrada, { recursive: true });
    esperarAProximaConferencia();

    expect(geradaEmDaFotoEmUso()).toBe("2026-10-13T09:55");
  });

  it("deixa nas conferidas só a cópia em uso", () => {
    foto.abrir();
    entregarFotoDeTeste(pastas.entrada, fotoGeradaEm("2026-10-13T10:30"));
    esperarAProximaConferencia();
    foto.abrir();

    expect(fs.readdirSync(pastas.conferidas)).toEqual([expect.stringMatching(/^foto-20261013-1030-1\.\d+\.db$/)]);
  });
});
