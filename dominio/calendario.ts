import { paraDiaUtc, somarDias, ultimoDiaDoMes } from "./datas.ts";

/*
 * O calendário de dias úteis do CRM. Por enquanto, o padrão: segunda a sexta, menos os feriados
 * nacionais (decisão do Lucas em 2026-10-14, no lugar do calendário do SGI). Antes de o CRM ficar
 * pronto, o Lucas define um calendário personalizado, que substitui este. Carnaval e Corpus Christi
 * são ponto facultativo, e não feriado nacional: aqui contam como dias úteis.
 */

/** Mês e dia dos feriados nacionais de data fixa. */
const FERIADOS_FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "12-25"];
/** Dia Nacional de Zumbi e da Consciência Negra: feriado nacional desde 2024 (Lei 14.759/2023). */
const CONSCIENCIA_NEGRA = { mesEDia: "11-20", desde: 2024 };

export function isDiaUtil(dataIso: string): boolean {
  return !isFimDeSemana(dataIso) && !isFeriadoNacional(dataIso);
}

export function isFeriadoNacional(dataIso: string): boolean {
  const ano = Number(dataIso.slice(0, 4));
  const mesEDia = dataIso.slice(5);
  const isConscienciaNegra = mesEDia === CONSCIENCIA_NEGRA.mesEDia && ano >= CONSCIENCIA_NEGRA.desde;
  const isSextaFeiraSanta = dataIso === somarDias(domingoDePascoa(ano), -2);
  return FERIADOS_FIXOS.includes(mesEDia) || isConscienciaNegra || isSextaFeiraSanta;
}

/** Dias úteis do mês até a data, inclusive: o "8º" de "8º de 22 dias úteis". */
export function diaUtilDoMes(dataIso: string): number {
  return diasDoMes(dataIso.slice(0, 7)).filter((dia) => dia <= dataIso && isDiaUtil(dia)).length;
}

export function diasUteisDoMes(mesIso: string): number {
  return diasDoMes(mesIso).filter(isDiaUtil).length;
}

/**
 * Onde acaba o "mesmo dia útil" num mês: a venda entra até antes do (N+1)º dia útil, para contar
 * as notas de sábado e de feriado logo depois do Nº (docs/dados-por-tela.md, Início). null quando
 * o mês tem N dias úteis ou menos: entra o mês inteiro.
 */
export function corteDoMesmoDiaUtil(mesIso: string, diaUtil: number): string | null {
  return diasDoMes(mesIso).filter(isDiaUtil)[diaUtil] ?? null;
}

function isFimDeSemana(dataIso: string): boolean {
  const diaDaSemana = new Date(paraDiaUtc(dataIso)).getUTCDay();
  return diaDaSemana === 0 || diaDaSemana === 6;
}

/** Pelo algoritmo de Meeus/Jones/Butcher, para o calendário gregoriano; as letras são as dele. */
function domingoDePascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function diasDoMes(mesIso: string): string[] {
  return Array.from({ length: ultimoDiaDoMes(mesIso) }, (_, i) => `${mesIso}-${String(i + 1).padStart(2, "0")}`);
}
