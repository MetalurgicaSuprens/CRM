import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { VERSAO_DO_ESQUEMA } from "dominio/esquemaDaFoto";
import { NOME_DE_TABELA, contarLinhasPorTabela, nomeDaFotoDoManifesto, type ManifestoDaFoto } from "dominio/manifestoDaFoto";

/*
 * A conferência da foto que chegou (docs/plano.md, "Troca da foto"). A entrada é de quem escreve
 * nela, e a foto pode mudar ou sumir depois de conferida: por isso o servidor copia a foto para uma
 * pasta só dele, confere a cópia e usa a cópia.
 */

export type PastasDaFoto = {
  /** Onde o extrator entrega a foto e o manifesto (na produção, a pasta do SFTP). */
  entrada: string;
  /** Só do servidor: as cópias conferidas. */
  conferidas: string;
};

export type FotoConferida = { arquivo: string; db: DatabaseSync; geradaEm: string };

/** O motivo vai para o log do servidor: só nomes de arquivo e de tabela, datas e números. */
export class FotoRecusada extends Error {}

/** O manifesto é um texto pequeno: maior que isso, não é manifesto. */
const TAMANHO_MAXIMO_DO_MANIFESTO = 64 * 1024;
const CAMPOS_DO_MANIFESTO = ["contagens", "geradaEm", "sha256", "tamanho", "versaoDoEsquema"].join();
const GERADA_EM = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/;

/**
 * Confere a foto de um manifesto da entrada e devolve a cópia aberta, só para leitura. A foto em
 * uso só é trocada por outra gerada depois dela.
 */
export function conferirFoto(pastas: PastasDaFoto, nomeDoManifesto: string, geradaEmDaAtual: string | null): FotoConferida {
  const nomeDaFoto = nomeDaFotoDoManifesto(nomeDoManifesto);
  if (!nomeDaFoto) throw new FotoRecusada("o nome não é de manifesto de foto");
  const manifesto = lerManifesto(path.join(pastas.entrada, nomeDoManifesto));
  if (manifesto.versaoDoEsquema !== VERSAO_DO_ESQUEMA) {
    throw new FotoRecusada(`esquema ${manifesto.versaoDoEsquema}, e o servidor lê o ${VERSAO_DO_ESQUEMA}`);
  }
  if (geradaEmDaAtual !== null && manifesto.geradaEm < geradaEmDaAtual) {
    throw new FotoRecusada(`gerada em ${manifesto.geradaEm}, antes da foto em uso, de ${geradaEmDaAtual}`);
  }
  const copia = copiarConferindoOHash(path.join(pastas.entrada, nomeDaFoto), pastas.conferidas, manifesto);
  try {
    return { arquivo: copia, db: abrirConferindo(copia, manifesto), geradaEm: manifesto.geradaEm };
  } catch (erro) {
    fs.rmSync(copia, { force: true });
    throw erro;
  }
}

function lerManifesto(arquivo: string): ManifestoDaFoto {
  if (fs.statSync(arquivo).size > TAMANHO_MAXIMO_DO_MANIFESTO) throw new FotoRecusada("o manifesto é grande demais");
  let valor: unknown;
  try {
    valor = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    throw new FotoRecusada("o manifesto não é JSON");
  }
  if (!isManifesto(valor)) throw new FotoRecusada("o manifesto não tem só os campos esperados, com os tipos esperados");
  return valor;
}

function isManifesto(valor: unknown): valor is ManifestoDaFoto {
  if (!isObjeto(valor) || Object.keys(valor).sort().join() !== CAMPOS_DO_MANIFESTO) return false;
  const { versaoDoEsquema, geradaEm, tamanho, sha256, contagens } = valor;
  return (
    Number.isSafeInteger(versaoDoEsquema) &&
    typeof geradaEm === "string" &&
    GERADA_EM.test(geradaEm) &&
    Number.isSafeInteger(tamanho) &&
    Number(tamanho) > 0 &&
    typeof sha256 === "string" &&
    SHA256.test(sha256) &&
    isObjeto(contagens) &&
    Object.entries(contagens).every(([tabela, linhas]) => NOME_DE_TABELA.test(tabela) && Number.isSafeInteger(linhas) && Number(linhas) >= 0)
  );
}

function isObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** O tamanho é conferido antes, para não copiar um arquivo que já se sabe errado. */
function copiarConferindoOHash(origem: string, pasta: string, { tamanho, sha256 }: ManifestoDaFoto): string {
  const tamanhoNaEntrada = fs.statSync(origem).size;
  if (tamanhoNaEntrada !== tamanho) throw new FotoRecusada(`a foto tem ${tamanhoNaEntrada} bytes, e o manifesto diz ${tamanho}`);
  fs.mkdirSync(pasta, { recursive: true });
  // O pid no nome: a linha de comando da administração também confere fotos, na mesma pasta.
  const copia = path.join(pasta, `${path.basename(origem, ".db")}.${process.pid}.db`);
  fs.copyFileSync(origem, copia);
  if (crypto.createHash("sha256").update(fs.readFileSync(copia)).digest("hex") !== sha256) {
    fs.rmSync(copia);
    throw new FotoRecusada("o sha256 da cópia não bate com o do manifesto");
  }
  return copia;
}

function abrirConferindo(arquivo: string, manifesto: ManifestoDaFoto): DatabaseSync {
  const db = new DatabaseSync(arquivo, { readOnly: true });
  try {
    conferirConteudo(db, manifesto);
    return db;
  } catch (erro) {
    db.close();
    throw erro;
  }
}

function conferirConteudo(db: DatabaseSync, manifesto: ManifestoDaFoto): void {
  if (db.prepare("PRAGMA quick_check").get()?.quick_check !== "ok") throw new FotoRecusada("a cópia não passou no quick_check");
  const foto = db.prepare("SELECT versao_esquema, gerada_em FROM foto").get();
  if (foto?.versao_esquema !== manifesto.versaoDoEsquema || foto?.gerada_em !== manifesto.geradaEm) {
    throw new FotoRecusada("a versão do esquema ou a data da foto não batem com as do manifesto");
  }
  const diferentes = tabelasComOutraContagem(contarLinhasPorTabela(db), manifesto.contagens);
  if (diferentes.length > 0) throw new FotoRecusada(`as linhas de ${diferentes.join(", ")} não batem com o manifesto`);
}

function tabelasComOutraContagem(naFoto: Record<string, number>, noManifesto: Record<string, number>): string[] {
  const foto = new Map(Object.entries(naFoto));
  const manifesto = new Map(Object.entries(noManifesto));
  return [...new Set([...foto.keys(), ...manifesto.keys()])].filter((tabela) => foto.get(tabela) !== manifesto.get(tabela)).sort();
}
