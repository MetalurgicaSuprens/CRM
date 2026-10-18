import { formatarMesCurto } from "../formato";

const MESES_DO_ANO = 12;

/**
 * Rótulos do eixo de meses (null onde não há rótulo). Num ano, um mês a cada `intervalo`. Em vários
 * anos, só cada janeiro, com o ano, como na linha da tendência.
 */
export function rotularMeses(meses: string[], intervalo: number): (string | null)[] {
  if (meses.length > MESES_DO_ANO) return meses.map((mes) => (mes.endsWith("-01") ? mes.slice(0, 4) : null));
  return meses.map((mes, indice) => (indice % intervalo === 0 ? formatarMesCurto(mes) : null));
}
