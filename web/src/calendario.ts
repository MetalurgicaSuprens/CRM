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

/** Dias úteis (segunda a sexta) do mês. Feriados ficam para a foto do ERP. */
export function diasUteisDoMes(mesIso: string): number {
  return diasUteisAte(`${mesIso}-${doisDigitos(ultimoDiaDoMes(mesIso))}`);
}

/** Dias úteis do mês até a data, inclusive. */
export function diasUteisAte(dataIso: string): number {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  let total = 0;
  for (let d = 1; d <= (dia ?? 0); d++) {
    const diaDaSemana = new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1, d)).getUTCDay();
    if (diaDaSemana !== 0 && diaDaSemana !== 6) total++;
  }
  return total;
}

export function ultimoDiaDoMes(mesIso: string): number {
  const [ano, mes] = mesIso.split("-").map(Number);
  return new Date(Date.UTC(ano ?? 1970, mes ?? 1, 0)).getUTCDate();
}

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, "0");
}
