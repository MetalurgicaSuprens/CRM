/** Datas de calendário como texto ISO ("2026-10-07"), sem fuso. */

export function hojeIso(agora = new Date()): string {
  return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`;
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
