import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { nomeDoManifesto } from "dominio/manifestoDaFoto";
import { enviarFotoMaisNova, planejarEnvio } from "./enviarFoto.ts";
import { abrirServidorSimulado, type ServidorSimulado } from "./servidorSimulado.ts";
import { APELIDO_DO_SERVIDOR, ErroNoEnvio, programaDoOpenSsh, type DestinoDoEnvio } from "./sftp.ts";

const FOTO = "foto-20261105-0900-2.db";
const MANIFESTO = nomeDoManifesto(FOTO);

function fotoDas(hora: string): string {
  return `foto-20261105-${hora}-1.db`;
}

describe("planejarEnvio", () => {
  it("leva a foto e, por último, o manifesto, cada um com nome provisório até chegar inteiro", () => {
    expect(planejarEnvio(FOTO, []).comandos).toEqual([
      `put ${FOTO} /entrada/${FOTO}.part`,
      `rename /entrada/${FOTO}.part /entrada/${FOTO}`,
      `put ${MANIFESTO} /entrada/${MANIFESTO}.part`,
      `rename /entrada/${MANIFESTO}.part /entrada/${MANIFESTO}`,
    ]);
  });

  it("não leva de novo a foto cujo manifesto já está no servidor", () => {
    expect(planejarEnvio(FOTO, [FOTO, MANIFESTO])).toEqual({ comandos: [], isEnviada: false, fotosApagadas: 0 });
  });

  it("refaz a entrega interrompida: tira a foto que ficou sem manifesto e reaproveita o nome provisório", () => {
    const { comandos } = planejarEnvio(FOTO, [FOTO, `${MANIFESTO}.part`]);

    expect(comandos[0]).toBe(`rm /entrada/${FOTO}`);
    expect(comandos).not.toContain(`rm /entrada/${MANIFESTO}.part`);
    expect(comandos.at(-1)).toBe(`rename /entrada/${MANIFESTO}.part /entrada/${MANIFESTO}`);
  });

  it("deixa só as 3 fotos mais novas e, na antiga, apaga o manifesto antes da foto, depois da entrega", () => {
    const antigas = ["0600", "0700", "0800"].flatMap((hora) => [fotoDas(hora), nomeDoManifesto(fotoDas(hora))]);

    const plano = planejarEnvio(FOTO, antigas);
    expect(plano.comandos.slice(4)).toEqual([`rm /entrada/${nomeDoManifesto(fotoDas("0600"))}`, `rm /entrada/${fotoDas("0600")}`]);
    expect(plano.fotosApagadas).toBe(1);
  });

  it("apaga o nome provisório que sobrou de outra foto", () => {
    expect(planejarEnvio(FOTO, [FOTO, MANIFESTO, `${fotoDas("0800")}.part`]).comandos).toEqual([`rm /entrada/${fotoDas("0800")}.part`]);
  });

  it("nunca leva aos comandos um nome do servidor fora do padrão", () => {
    const { comandos } = planejarEnvio(FOTO, ["foto-1.db !del", "../app.db", "outra.db", "foto-2.db\n!calc"]);

    expect(comandos).toHaveLength(4);
    expect(comandos.join("\n")).not.toMatch(/!|app\.db|outra/);
  });
});

describe("enviarFotoMaisNova, com o servidor simulado", { timeout: 60_000 }, () => {
  let pasta: string;
  let chaveDoExtrator: string;
  let servidor: ServidorSimulado;
  let raizDoServidor: string;
  let pastaDasFotos: string;
  let destino: DestinoDoEnvio;

  beforeAll(() => {
    pasta = fs.mkdtempSync(path.join(os.tmpdir(), "crm-envio-"));
    chaveDoExtrator = path.join(pasta, "chave-do-extrator");
    const gerada = spawnSync(programaDoOpenSsh("ssh-keygen"), ["-q", "-t", "ed25519", "-N", "", "-C", "extrator", "-f", chaveDoExtrator]);
    if (gerada.status !== 0) throw new Error(`ssh-keygen falhou: ${String(gerada.stderr)}`);
  });

  afterAll(() => {
    fs.rmSync(pasta, { recursive: true, force: true });
  });

  beforeEach(async () => {
    raizDoServidor = fs.mkdtempSync(path.join(pasta, "servidor-"));
    fs.mkdirSync(path.join(raizDoServidor, "entrada"));
    pastaDasFotos = fs.mkdtempSync(path.join(pasta, "fotos-"));
    servidor = await abrirServidorSimulado({ raiz: raizDoServidor, usuario: "crm-troca", chaveAutorizada: fs.readFileSync(`${chaveDoExtrator}.pub`, "utf8") });
    destino = { endereco: "127.0.0.1", porta: servidor.porta, usuario: "crm-troca", chave: chaveDoExtrator, servidorConhecido: conhecer(servidor.chavePublica) };
  });

  afterEach(async () => {
    await servidor.fechar();
  });

  /** O arquivo com a chave do servidor, como o extrator guarda. */
  function conhecer(chavePublica: string): string {
    const arquivo = path.join(pasta, `servidor-conhecido-${servidor.porta}`);
    fs.writeFileSync(arquivo, `${APELIDO_DO_SERVIDOR} ${chavePublica}\n`);
    return arquivo;
  }

  function gravarFotoLocal(nome: string): void {
    fs.writeFileSync(path.join(pastaDasFotos, nome), `foto ${nome}`);
    fs.writeFileSync(path.join(pastaDasFotos, nomeDoManifesto(nome)), `manifesto ${nome}`);
  }

  function naEntrada(): string[] {
    return fs.readdirSync(path.join(raizDoServidor, "entrada")).sort();
  }

  it("entrega a foto e o manifesto inteiros, o manifesto depois da foto", async () => {
    gravarFotoLocal(FOTO);

    expect(await enviarFotoMaisNova(pastaDasFotos, destino)).toEqual({ foto: FOTO, isEnviada: true, fotosApagadas: 0 });
    expect(naEntrada()).toEqual([FOTO, MANIFESTO]);
    expect(fs.readFileSync(path.join(raizDoServidor, "entrada", FOTO), "utf8")).toBe(`foto ${FOTO}`);
    expect(servidor.operacoes).toEqual([`rename /entrada/${FOTO}.part /entrada/${FOTO}`, `rename /entrada/${MANIFESTO}.part /entrada/${MANIFESTO}`]);
  });

  it("não envia de novo a foto que já chegou", async () => {
    gravarFotoLocal(FOTO);
    await enviarFotoMaisNova(pastaDasFotos, destino);
    servidor.operacoes.length = 0;

    expect((await enviarFotoMaisNova(pastaDasFotos, destino)).isEnviada).toBe(false);
    expect(servidor.operacoes).toEqual([]);
  });

  it("deixa no servidor só as 3 fotos mais novas", async () => {
    for (const hora of ["0600", "0700", "0800", "0900"]) {
      gravarFotoLocal(fotoDas(hora));
      await enviarFotoMaisNova(pastaDasFotos, destino);
    }

    expect(naEntrada()).toEqual(["0700", "0800", "0900"].flatMap((hora) => [fotoDas(hora), nomeDoManifesto(fotoDas(hora))]).sort());
  });

  it("não envia nada ao servidor que mostra outra chave", async () => {
    gravarFotoLocal(FOTO);
    const impostor = { ...destino, servidorConhecido: conhecer(`ssh-ed25519 ${"A".repeat(68)}`) };

    await expect(enviarFotoMaisNova(pastaDasFotos, impostor)).rejects.toThrow(/não mostrou a chave conhecida/);
    expect(naEntrada()).toEqual([]);
  });

  it("para, sem perguntar nada, quando o servidor não aceita a chave do extrator", async () => {
    gravarFotoLocal(FOTO);

    await expect(enviarFotoMaisNova(pastaDasFotos, { ...destino, usuario: "outro" })).rejects.toThrow(/não aceitou a chave do extrator/);
  });

  it("recusa enviar sem foto com manifesto", async () => {
    fs.writeFileSync(path.join(pastaDasFotos, FOTO), "foto sem manifesto");

    await expect(enviarFotoMaisNova(pastaDasFotos, destino)).rejects.toThrow(ErroNoEnvio);
  });
});
