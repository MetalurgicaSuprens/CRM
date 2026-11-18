/*
 * A foto ilustrativa do produto no pedido, uma por família: as mesmas fotos do site da Suprens, que o
 * Gestão já usa (Gestao/server/src/engenharia/itens/imagemFamilia.ts), reduzidas para web/public/familias
 * (a escolha do Lucas em 2026-11-18). Algumas linhas comerciais ficam, no cadastro, dentro de outra
 * família e têm foto própria pelo começo do código: as borboletas (FAN, MAN, PAN).
 */

const PASTA = "/familias";

const FOTO_POR_FAMILIA: Readonly<Record<string, string>> = {
  FLEXIL: "flexil",
  "KIT FLEXIL": "kit-flexil",
  "FLEXIL SUPER": "flexil-super",
  MICRO: "micro",
  "CRON 9MM": "cron9mm",
  "CRON 12MM": "cron12mm",
  "CRON 9/12MM COM MOLA": "croncommola",
  PRESIL: "presil",
  TUCHO: "tucho",
  "TIGRE(MT)": "tigre",
  "STEPLESS (G)": "stepless",
  RADIAL: "radial",
  BORRACHA: "borracha",
  "BORRACHA DIN3016-1": "borracha-din",
  "MANGOTE(MS)": "ms",
  SIMPLEX: "simplex",
  U: "u",
  "ABRAC. ZIP": "zip",
  MOLA: "mola",
  ESTAMPADOS: "estampadosv2",
};

const FOTO_POR_COMECO_DO_CODIGO: readonly (readonly [comeco: string, foto: string])[] = [
  ["FAN", "flexil-borboleta"],
  ["MAN", "micro-borboleta"],
  ["PAN", "presil-borboleta"],
];

/** O endereço da foto do produto, ou null quando a família não tem foto (como Fita perfurada, Outros e Alicate). */
export function fotoDoProduto(codigo: string, familia: string): string | null {
  const porCodigo = FOTO_POR_COMECO_DO_CODIGO.find(([comeco]) => codigo.toUpperCase().startsWith(comeco));
  const foto = porCodigo?.[1] ?? FOTO_POR_FAMILIA[familia.trim().toUpperCase()];
  return foto ? `${PASTA}/${foto}.png` : null;
}
