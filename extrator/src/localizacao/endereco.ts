/*
 * O endereço do cliente como o ERP guarda (CRCL.ENDERECO, um texto só, com o número depois da
 * vírgula: "R XV DE NOVEMBRO, 1200 SALA 3") e a mesma rua escrita como no Cadastro de Endereços do
 * IBGE (CNEFE), para os dois se acharem: sem o tipo da rua, o título e as palavras de ligação.
 */

export type NumeroDoEndereco = { rua: string; numero: number | null };

/**
 * A rua e o número. O número é o primeiro inteiro logo depois da primeira vírgula; "S/N", "KM 12" ou
 * texto no lugar dele deixam o endereço sem número. Sem vírgula, o endereço também fica sem número:
 * em "RUA 7 DE SETEMBRO" o 7 é da rua.
 */
export function separarNumero(endereco: string): NumeroDoEndereco {
  const virgula = endereco.indexOf(",");
  if (virgula < 0) return { rua: endereco.trim(), numero: null };
  const depois = endereco.slice(virgula + 1).trim();
  const numero = /^(?:N[º°O.]*\s*)?(\d+)/i.exec(depois)?.[1];
  return { rua: endereco.slice(0, virgula).trim(), numero: numero === undefined ? null : Number(numero) };
}

/** O tipo da rua, como o ERP e o CNEFE escrevem, por extenso e abreviado. */
const TIPOS_DE_RUA = new Set([
  "R", "RUA", "AV", "AVE", "AVENIDA", "ROD", "RODOVIA", "EST", "ESTR", "ESTRADA", "ESTM", "VIA", "V",
  "TV", "TRAV", "TRAVESSA", "AL", "ALAMEDA", "PC", "PCA", "PRACA", "LG", "LARGO", "TR", "TRECHO",
  "VD", "VIADUTO", "VL", "VIELA", "BC", "BECO", "Q", "QD", "QUADRA", "SQ", "ST", "SETOR", "AREA",
]);

/** Títulos que o CNEFE guarda à parte (NOM_TITULO_SEGLOGR) e o ERP escreve no nome. */
const TITULOS = new Set([
  "DR", "DOUTOR", "DRA", "DOUTORA", "PROF", "PROFESSOR", "PROFA", "PROFESSORA", "ENG", "ENGENHEIRO",
  "CEL", "CORONEL", "GOV", "GOVERNADOR", "PRES", "PRESIDENTE", "VER", "VEREADOR", "DEP", "DEPUTADO",
  "SEN", "SENADOR", "PE", "PADRE", "CAP", "CAPITAO", "GEN", "GENERAL", "MAL", "MARECHAL", "TEN",
  "TENENTE", "MAJ", "MAJOR", "SGT", "SARGENTO", "BRIG", "BRIGADEIRO", "ALM", "ALMIRANTE", "COM",
  "COMENDADOR", "DES", "DESEMBARGADOR", "MIN", "MINISTRO", "PREF", "PREFEITO", "D", "DONA", "DOM",
]);

const LIGACOES = new Set(["DE", "DA", "DO", "DAS", "DOS", "E"]);

/**
 * A rua reduzida ao nome, para comparar o ERP com o CNEFE: maiúsculas, sem acento nem pontuação, sem
 * o tipo no começo, sem títulos e sem "de", "da", "do". "AV. DR. JOÃO DA SILVA" e "JOAO SILVA" dão o
 * mesmo. O tipo e o título só caem no começo: "RUA DOM PEDRO" vira "PEDRO", mas "RUA SAO PEDRO",
 * não; e um nome que fosse só título fica como está.
 */
export function chaveDaRua(rua: string): string {
  const palavras = rua
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((palavra) => palavra !== "");
  let inicio = 0;
  while (inicio < palavras.length - 1 && (TIPOS_DE_RUA.has(palavras[inicio] ?? "") || TITULOS.has(palavras[inicio] ?? ""))) inicio += 1;
  return palavras
    .slice(inicio)
    .filter((palavra) => !LIGACOES.has(palavra))
    .join(" ");
}

/** O CEP com 8 dígitos; o ERP guarda como número e perde o zero da esquerda (01310-100 vira 1310100). */
export function cepDoErp(cep: number | null): string | null {
  if (cep === null || !Number.isInteger(cep) || cep < 1_000_000 || cep > 99_999_999) return null;
  return String(cep).padStart(8, "0");
}

/**
 * O CEP único da cidade, que os Correios dão às localidades sem CEP por rua, termina em 000. O meio
 * dele é o meio da cidade, que o mapa já tem: não vale como ponto do cliente.
 */
export function isCepDaCidadeToda(cep: string): boolean {
  return cep.endsWith("000");
}
