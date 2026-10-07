import { formatarMesAno, formatarMesCurto } from "../formato";

/**
 * Rótulos do eixo de meses: um a cada `intervalo` meses (null nos demais).
 * Com `comAno`, o ano aparece no primeiro rótulo e sempre que muda em relação ao rótulo anterior.
 */
export function rotularMeses(meses: string[], intervalo: number, comAno: boolean): (string | null)[] {
  let anoDoRotuloAnterior = "";
  return meses.map((mes, indice) => {
    if (indice % intervalo !== 0) return null;
    const ano = mes.slice(0, 4);
    const rotulo = comAno && ano !== anoDoRotuloAnterior ? formatarMesAno(mes) : formatarMesCurto(mes);
    anoDoRotuloAnterior = ano;
    return rotulo;
  });
}
