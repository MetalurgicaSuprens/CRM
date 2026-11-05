import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { NOME_DE_TABELA, tabelasDaFoto } from "dominio/manifestoDaFoto";

/*
 * A impressão digital do conteúdo da foto (docs/plano.md, "extrator/", "Antes de gravar"): sai igual
 * quando nada mudou no ERP desde a foto anterior. Fica de fora só a hora em que a foto foi gerada;
 * a data de referência entra, para a virada do dia sempre dar foto nova.
 */

/**
 * As somas do Oracle mudam o último algarismo de uma carga para a outra (340232.62999999995 e
 * 340232.63000000006, sem nada mudar): 12 algarismos ainda separam um centavo de milhões de reais.
 */
const ALGARISMOS = 12;
const FORA_DA_IMPRESSAO = new Set(["foto.gerada_em"]);

export function impressaoDigital(db: DatabaseSync): string {
  const hash = crypto.createHash("sha256");
  for (const tabela of tabelasDaFoto(db)) {
    const colunas = colunasDa(db, tabela).filter((coluna) => !FORA_DA_IMPRESSAO.has(`${tabela}.${coluna}`));
    const lista = colunas.join(", ");
    hash.update(`#${tabela}\n`);
    // Em ordem pelo conteúdo: o Oracle pode devolver as linhas noutra ordem sem nada ter mudado.
    for (const linha of db.prepare(`SELECT ${lista} FROM ${tabela} ORDER BY ${lista}`).iterate()) {
      hash.update(`${JSON.stringify(Object.values(linha).map(normalizar))}\n`);
    }
  }
  return hash.digest("hex");
}

/** O nome da tabela já foi conferido; o das colunas segue o mesmo padrão, para entrar no SQL. */
function colunasDa(db: DatabaseSync, tabela: string): string[] {
  const colunas = db
    .prepare(`SELECT name FROM pragma_table_info('${tabela}') ORDER BY cid`)
    .all()
    .map((linha) => String(linha.name));
  const estranha = colunas.find((coluna) => !/^[a-z_0-9]+$/.test(coluna));
  if (estranha !== undefined || !NOME_DE_TABELA.test(tabela)) throw new Error(`A tabela ${tabela} tem uma coluna fora do padrão de nome: "${estranha}".`);
  return colunas;
}

function normalizar(valor: unknown): unknown {
  return typeof valor === "number" && !Number.isInteger(valor) ? Number(valor.toPrecision(ALGARISMOS)) : valor;
}
