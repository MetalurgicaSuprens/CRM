import type { DatabaseSync } from "node:sqlite";

/*
 * As chaves de acesso de cada usuário: só a chave pública, o contador e de onde ela é. O admin vê
 * cada chave pelo provedor, porque uma chave sincronizada vale em vários aparelhos
 * (docs/plano.md, "Chave de acesso").
 */

export type NovaChave = {
  id: string;
  usuario: string;
  chavePublica: Uint8Array;
  contador: number;
  transportes: string[];
  aaguid: string;
  /** Sincronizada pelo Google, pela Apple ou por um gerenciador de senhas: vale em mais de um aparelho. */
  sincronizada: boolean;
};

export type ChaveGravada = {
  id: string;
  usuario: string;
  chavePublica: Uint8Array;
  contador: number;
  transportes: string[];
  revogada: boolean;
};

export type ResumoDaChave = { id: string; provedor: string; criadaEm: string; ultimoUso: string | null; revogada: boolean };

/**
 * O provedor pelo AAGUID, a identificação do tipo de autenticador. Só os conhecidos; o resto, e o
 * AAGUID zerado que alguns navegadores mandam, fica "Chave de acesso".
 */
const PROVEDORES: Readonly<Record<string, string>> = {
  "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": "Google",
  "adce0002-35bc-c60a-648b-0b25f1f05503": "Chrome no Mac",
  "08987058-cadc-4b81-b6e1-30de50dcbe96": "Windows Hello",
  "9ddd1817-af5a-4672-a2b9-3e3dd95000a9": "Windows Hello",
  "6028b017-b1d4-4c02-b4b3-afcdafc96bb2": "Windows Hello",
  "fbfc3007-154e-4ecc-8c0b-6e020557d7bd": "Apple",
  "dd4ec289-e01d-41c9-bb89-70fa845d4bf2": "Apple",
  "53414d53-554e-4700-0000-000000000000": "Samsung Pass",
  "bada5566-a7aa-401f-bd96-45619a55120d": "1Password",
  "d548826e-79b4-db40-a3d8-11116f7e8349": "Bitwarden",
};

export function provedorDaChave(aaguid: string): string {
  return PROVEDORES[aaguid.toLowerCase()] ?? "Chave de acesso";
}

export function gravarChave(banco: DatabaseSync, chave: NovaChave, agora: Date): void {
  banco
    .prepare(
      `INSERT INTO chaves (id, usuario, chave_publica, contador, transportes, aaguid, provedor, sincronizada, criada_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      chave.id,
      chave.usuario,
      chave.chavePublica,
      chave.contador,
      JSON.stringify(chave.transportes),
      chave.aaguid,
      provedorDaChave(chave.aaguid),
      chave.sincronizada ? 1 : 0,
      agora.toISOString(),
    );
}

export function buscarChave(banco: DatabaseSync, id: string): ChaveGravada | null {
  const linha = banco.prepare("SELECT id, usuario, chave_publica, contador, transportes, revogada_em FROM chaves WHERE id = ?").get(id);
  if (!linha) return null;
  return {
    id: String(linha.id),
    usuario: String(linha.usuario),
    chavePublica: linha.chave_publica as Uint8Array,
    contador: Number(linha.contador),
    transportes: JSON.parse(String(linha.transportes)) as string[],
    revogada: linha.revogada_em !== null,
  };
}

/** As chaves ativas do usuário, para o aparelho que já tem uma não criar outra igual. */
export function chavesAtivasDo(banco: DatabaseSync, usuario: string): { id: string; transportes: string[] }[] {
  return banco
    .prepare("SELECT id, transportes FROM chaves WHERE usuario = ? AND revogada_em IS NULL")
    .all(usuario)
    .map((linha) => ({ id: String(linha.id), transportes: JSON.parse(String(linha.transportes)) as string[] }));
}

export function resumoDasChavesDo(banco: DatabaseSync, usuario: string): ResumoDaChave[] {
  return banco
    .prepare("SELECT id, provedor, criada_em, ultimo_uso, revogada_em FROM chaves WHERE usuario = ? ORDER BY criada_em")
    .all(usuario)
    .map((linha) => ({
      id: String(linha.id),
      provedor: String(linha.provedor),
      criadaEm: String(linha.criada_em),
      ultimoUso: linha.ultimo_uso === null ? null : String(linha.ultimo_uso),
      revogada: linha.revogada_em !== null,
    }));
}

export function registrarUsoDaChave(banco: DatabaseSync, { id, contador }: { id: string; contador: number }, agora: Date): void {
  banco.prepare("UPDATE chaves SET contador = ?, ultimo_uso = ? WHERE id = ?").run(contador, agora.toISOString(), id);
}

/** Revoga todas as chaves ativas do usuário; devolve quantas. */
export function revogarChavesDo(banco: DatabaseSync, usuario: string, agora: Date): number {
  return Number(banco.prepare("UPDATE chaves SET revogada_em = ? WHERE usuario = ? AND revogada_em IS NULL").run(agora.toISOString(), usuario).changes);
}
