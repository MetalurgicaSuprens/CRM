/** Datas de calendário como texto ISO ("2026-10-07"), sem fuso, e o relógio de Brasília. */

const RELOGIO_DE_BRASILIA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Data e hora em Brasília ("2026-10-09T09:15"), qualquer que seja o fuso do aparelho. */
export function momentoEmBrasilia(agora = new Date()): string {
  const partes = new Map(RELOGIO_DE_BRASILIA.formatToParts(agora).map(({ type, value }) => [type, value]));
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.get(tipo) ?? "";
  return `${parte("year")}-${parte("month")}-${parte("day")}T${parte("hour")}:${parte("minute")}`;
}

/** "2026-10-09T09:15" → "2026-10-09" */
export function dataDoMomento(momentoIso: string): string {
  return momentoIso.slice(0, 10);
}

/** "2026-10-09T09:15" → "09:15" */
export function horaDoMomento(momentoIso: string): string {
  return momentoIso.slice(11, 16);
}

/** "2026-10-07" → "2026-10" */
export function mesDe(dataIso: string): string {
  return dataIso.slice(0, 7);
}

export function somarMeses(mesIso: string, quantidade: number): string {
  const [ano, mes] = mesIso.split("-").map(Number);
  const indice = (ano ?? 1970) * 12 + ((mes ?? 1) - 1) + quantidade;
  return `${Math.floor(indice / 12)}-${doisDigitos((indice % 12) + 1)}`;
}

export function somarDias(dataIso: string, quantidade: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const data = new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1, (dia ?? 1) + quantidade));
  return `${data.getUTCFullYear()}-${doisDigitos(data.getUTCMonth() + 1)}-${doisDigitos(data.getUTCDate())}`;
}

export function diasEntre(deIso: string, ateIso: string): number {
  return Math.round((paraDiaUtc(ateIso) - paraDiaUtc(deIso)) / 86_400_000);
}

export function ultimoDiaDoMes(mesIso: string): number {
  const [ano, mes] = mesIso.split("-").map(Number);
  return new Date(Date.UTC(ano ?? 1970, mes ?? 1, 0)).getUTCDate();
}

/** "2026-02-30" passa no formato AAAA-MM-DD, mas não existe. */
export function isDataDeVerdade(dataIso: string): boolean {
  const momento = Date.parse(`${dataIso}T00:00:00Z`);
  return !Number.isNaN(momento) && new Date(momento).toISOString().slice(0, 10) === dataIso;
}

/** Meia-noite da data em UTC, em milissegundos: a data de calendário sem o fuso do aparelho. */
export function paraDiaUtc(dataIso: string): number {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  return Date.UTC(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1);
}

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, "0");
}
