import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VERSAO_DO_ESQUEMA, type Foto } from "dominio/esquemaDaFoto";
import { nomeDaFotoDoManifesto, type ManifestoDaFoto } from "dominio/manifestoDaFoto";
import { entregarFotoDeTeste, montarFotoDeTeste } from "../fotoDeTeste.ts";
import { conferirFoto, FotoRecusada, type PastasDaFoto } from "./conferirFoto.ts";

let raiz: string;
let pastas: PastasDaFoto;

beforeEach(() => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), "crm-conferir-"));
  pastas = { entrada: path.join(raiz, "entrada"), conferidas: path.join(raiz, "conferidas") };
});

afterEach(() => {
  fs.rmSync(raiz, { recursive: true, force: true });
});

function fotoDaVersao(versao: number): Foto {
  const foto = montarFotoDeTeste();
  return { ...foto, foto: { ...foto.foto, versao_esquema: versao } };
}

function entregarComManifesto(mudar: (manifesto: ManifestoDaFoto) => ManifestoDaFoto): string {
  return entregarFotoDeTeste(pastas.entrada, montarFotoDeTeste(), mudar);
}

function arquivoDaFoto(manifesto: string): string {
  return path.join(pastas.entrada, nomeDaFotoDoManifesto(manifesto) ?? "");
}

/** Muda um byte da foto da entrada, sem mudar o tamanho. */
function mudarUmByte(arquivo: string, posicao: number): void {
  const conteudo = fs.readFileSync(arquivo);
  conteudo[posicao] = (conteudo[posicao] ?? 0) ^ 0xff;
  fs.writeFileSync(arquivo, conteudo);
}

describe("conferirFoto", () => {
  it("aceita a foto que bate com o manifesto e abre a cópia, na pasta das conferidas", () => {
    const manifesto = entregarFotoDeTeste(pastas.entrada, montarFotoDeTeste());

    const conferida = conferirFoto(pastas, manifesto, null);
    expect(path.dirname(conferida.arquivo)).toBe(pastas.conferidas);
    expect(conferida.geradaEm).toBe("2026-10-13T09:55");
    expect(conferida.db.prepare("SELECT COUNT(*) AS linhas FROM representante").get()?.linhas).toBe(2);
    conferida.db.close();
  });

  it("recusa a foto que mudou depois do manifesto", () => {
    const manifesto = entregarFotoDeTeste(pastas.entrada, montarFotoDeTeste());
    mudarUmByte(arquivoDaFoto(manifesto), 5_000);

    expect(() => conferirFoto(pastas, manifesto, null)).toThrow(/sha256/);
  });

  it("recusa a foto de tamanho diferente do manifesto, antes de copiá-la", () => {
    const manifesto = entregarComManifesto((original) => ({ ...original, tamanho: original.tamanho + 1 }));

    expect(() => conferirFoto(pastas, manifesto, null)).toThrow(/bytes/);
    expect(fs.existsSync(pastas.conferidas)).toBe(false);
  });

  it("recusa a foto de outra versão do esquema", () => {
    const manifesto = entregarFotoDeTeste(pastas.entrada, fotoDaVersao(VERSAO_DO_ESQUEMA - 1));

    expect(() => conferirFoto(pastas, manifesto, null)).toThrow(`esquema ${VERSAO_DO_ESQUEMA - 1}, e o servidor lê o ${VERSAO_DO_ESQUEMA}`);
  });

  it("recusa a foto gerada antes da que está em uso", () => {
    const manifesto = entregarFotoDeTeste(pastas.entrada, montarFotoDeTeste());

    expect(() => conferirFoto(pastas, manifesto, "2026-10-13T10:00")).toThrow("gerada em 2026-10-13T09:55, antes da foto em uso, de 2026-10-13T10:00");
  });

  it("recusa a foto cujas linhas não batem com as do manifesto, e apaga a cópia", () => {
    const manifesto = entregarComManifesto((original) => ({ ...original, contagens: { ...original.contagens, cliente: 999 } }));

    expect(() => conferirFoto(pastas, manifesto, null)).toThrow("as linhas de cliente não batem com o manifesto");
    expect(fs.readdirSync(pastas.conferidas)).toEqual([]);
  });

  it("recusa o manifesto com um campo a mais", () => {
    const manifesto = entregarComManifesto((original) => ({ ...original, assinatura: "x" }) as ManifestoDaFoto);

    expect(() => conferirFoto(pastas, manifesto, null)).toThrow(/campos esperados/);
  });

  it("recusa o manifesto que não é JSON", () => {
    const manifesto = entregarFotoDeTeste(pastas.entrada, montarFotoDeTeste());
    fs.writeFileSync(path.join(pastas.entrada, manifesto), "{");

    expect(() => conferirFoto(pastas, manifesto, null)).toThrow("o manifesto não é JSON");
  });

  it("recusa o nome que não é de manifesto de foto, sem ler o arquivo", () => {
    expect(() => conferirFoto(pastas, "../app.db", null)).toThrow(FotoRecusada);
  });

  it("recusa a cópia estragada, mesmo com o hash certo no manifesto, e apaga a cópia", () => {
    const manifesto = entregarFotoDeTeste(pastas.entrada, montarFotoDeTeste());
    const arquivo = arquivoDaFoto(manifesto);
    // O primeiro byte da página 5 é o tipo da página, e zero não é tipo de página do SQLite.
    const conteudo = fs.readFileSync(arquivo);
    conteudo.fill(0, 4 * 4_096, 5 * 4_096);
    fs.writeFileSync(arquivo, conteudo);
    const original = JSON.parse(fs.readFileSync(path.join(pastas.entrada, manifesto), "utf8")) as ManifestoDaFoto;
    const sha256 = crypto.createHash("sha256").update(conteudo).digest("hex");
    fs.writeFileSync(path.join(pastas.entrada, manifesto), JSON.stringify({ ...original, sha256 }));

    expect(() => conferirFoto(pastas, manifesto, null)).toThrow();
    expect(fs.readdirSync(pastas.conferidas)).toEqual([]);
  });
});
