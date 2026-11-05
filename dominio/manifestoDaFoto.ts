/*
 * O manifesto que acompanha cada foto do extrator até o servidor (docs/plano.md, "Troca da foto").
 * O extrator grava a foto e, por último, o manifesto; o servidor só considera a foto que tem
 * manifesto e confere a cópia dela contra ele.
 */

export type ManifestoDaFoto = {
  versaoDoEsquema: number;
  /** O `foto.gerada_em`: "2026-10-13T09:50", hora de Brasília no Oracle. */
  geradaEm: string;
  /** Bytes do arquivo da foto. */
  tamanho: number;
  sha256: string;
  /** Linhas de cada tabela da foto, como `contarLinhasPorTabela` conta. */
  contagens: Record<string, number>;
};

const SUFIXO_DA_FOTO = ".db";
const SUFIXO_DO_MANIFESTO = ".manifesto.json";
/** "foto-20261013-0955-1792345678901.manifesto.json": o nome que o extrator dá, e nada além dele. */
const NOME_DO_MANIFESTO = /^foto-[0-9-]+\.manifesto\.json$/;
/** Toda tabela da foto tem nome assim: o nome entra no SQL da contagem e no log do servidor. */
export const NOME_DE_TABELA = /^[a-z_]+$/;

/** "foto-x.db" → "foto-x.manifesto.json". */
export function nomeDoManifesto(nomeDaFoto: string): string {
  return `${nomeDaFoto.slice(0, -SUFIXO_DA_FOTO.length)}${SUFIXO_DO_MANIFESTO}`;
}

/** "foto-x.manifesto.json" → "foto-x.db"; null se o nome não é de manifesto de foto. */
export function nomeDaFotoDoManifesto(nome: string): string | null {
  if (!NOME_DO_MANIFESTO.test(nome)) return null;
  return `${nome.slice(0, -SUFIXO_DO_MANIFESTO.length)}${SUFIXO_DA_FOTO}`;
}

/** O pedaço do node:sqlite que a contagem usa: o dominio não depende do Node. */
type BancoQueConta = {
  prepare(sql: string): { all(): Record<string, unknown>[]; get(): Record<string, unknown> | undefined };
};

/** As linhas de cada tabela: o extrator as põe no manifesto, e o servidor confere a cópia com elas. */
export function contarLinhasPorTabela(db: BancoQueConta): Record<string, number> {
  return Object.fromEntries(tabelasDaFoto(db).map((tabela) => [tabela, Number(db.prepare(`SELECT COUNT(*) AS linhas FROM ${tabela}`).get()?.linhas)]));
}

/** As tabelas em ordem de nome, já conferidas: o nome pode entrar no SQL. */
export function tabelasDaFoto(db: BancoQueConta): string[] {
  const tabelas = db
    .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
    .all()
    .map((linha) => String(linha.name));
  const estranha = tabelas.find((tabela) => !NOME_DE_TABELA.test(tabela));
  if (estranha !== undefined) throw new Error(`A foto tem uma tabela fora do padrão de nome: "${estranha}".`);
  return tabelas;
}
