import type { DatabaseSync } from "node:sqlite";
import { dataDoMomento, diasEntre, isDataDeVerdade, momentoEmBrasilia } from "dominio/datas";

/*
 * As visitas do representante aos clientes, no app.db: só o dia, por login e cliente (o id opaco da
 * foto), sem texto livre, para não guardar dado pessoal. O Mapa usa a última de cada cliente; a ficha,
 * as mais recentes.
 */

/** Até quantos dias para trás a visita pode ser marcada. */
export const DIAS_PARA_TRAS = 30;
/** Quantas visitas a ficha mostra, das mais recentes. */
const VISITAS_NA_FICHA = 10;

export type Visita = { usuario: string; cliente: string; data: string };
export type ProblemaNaData = "invalida" | "futura" | "antiga";

/** A data da visita: a de hoje em Brasília, ou a pedida, se for uma data de verdade, nem futura nem de mais de 30 dias. */
export function dataDaVisita(pedida: string | undefined, agora: Date): { data: string } | { problema: ProblemaNaData } {
  const hoje = dataDoMomento(momentoEmBrasilia(agora));
  const data = pedida ?? hoje;
  if (!isDataDeVerdade(data)) return { problema: "invalida" };
  if (data > hoje) return { problema: "futura" };
  return diasEntre(data, hoje) > DIAS_PARA_TRAS ? { problema: "antiga" } : { data };
}

/** Marcar de novo o mesmo dia não duplica. */
export function registrarVisita(banco: DatabaseSync, { usuario, cliente, data }: Visita, agora: Date): void {
  banco.prepare("INSERT OR IGNORE INTO visitas (usuario, cliente, data, registrada_em) VALUES (?, ?, ?, ?)").run(usuario, cliente, data, agora.toISOString());
}

export function desfazerVisita(banco: DatabaseSync, { usuario, cliente, data }: Visita): void {
  banco.prepare("DELETE FROM visitas WHERE usuario = ? AND cliente = ? AND data = ?").run(usuario, cliente, data);
}

/** Os dias em que o login visitou algum destes clientes, do mais recente ao mais antigo, até 10. */
export function visitasDosClientes(banco: DatabaseSync, usuario: string, clientes: readonly string[]): string[] {
  if (clientes.length === 0) return [];
  return banco
    .prepare(`SELECT DISTINCT data FROM visitas WHERE usuario = ? AND cliente IN (${clientes.map(() => "?").join(", ")}) ORDER BY data DESC LIMIT ?`)
    .all(usuario, ...clientes, VISITAS_NA_FICHA)
    .map((linha) => String(linha.data));
}

/** A última visita do login a cada cliente que ele visitou. */
export function ultimasVisitas(banco: DatabaseSync, usuario: string): Record<string, string> {
  const linhas = banco.prepare("SELECT cliente, MAX(data) AS data FROM visitas WHERE usuario = ? GROUP BY cliente").all(usuario);
  return Object.fromEntries(linhas.map((linha) => [String(linha.cliente), String(linha.data)]));
}
