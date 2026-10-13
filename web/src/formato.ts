import { dataDoMomento, horaDoMomento } from "./calendario";

const REAIS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const INTEIRO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const UMA_CASA = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MENOS = "−";
const LISTA = new Intl.ListFormat("pt-BR", { type: "conjunction" });
/** Em UTC porque a data já chega pronta: o fuso do aparelho não pode mudar o dia. */
const DIA_POR_EXTENSO = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Valor em reais, sem centavos (regra aprovada no protótipo). */
export function formatarReais(valor: number): string {
  return REAIS.format(Math.round(valor)).replace("-", MENOS);
}

/** "R$ 950", "R$ 48,5 mil", "R$ 182 mil", "R$ 1,2 mi". */
export function formatarReaisCompacto(valor: number): string {
  const sinal = valor < 0 ? MENOS : "";
  return `${sinal}R$ ${formatarCompacto(Math.abs(valor))}`;
}

/** Número sem moeda, para eixos de gráfico: "950", "48,5 mil", "1,2 mi". */
export function formatarCompacto(valor: number): string {
  const absoluto = Math.abs(valor);
  if (absoluto >= 999_500) return `${UMA_CASA.format(absoluto / 1_000_000)} mi`;
  if (absoluto >= 999.5) {
    const emMil = absoluto / 1_000;
    const formato = emMil < 99.95 ? UMA_CASA : INTEIRO;
    return `${formato.format(emMil)} mil`;
  }
  return INTEIRO.format(absoluto);
}

export function formatarNumero(valor: number): string {
  return INTEIRO.format(valor);
}

/** Variação relativa (0,083 → "+8%"); uma casa decimal abaixo de 1%. */
export function formatarVariacao(razao: number): string {
  const percentual = razao * 100;
  const arredondado = Math.abs(percentual) < 1 ? Math.round(percentual * 10) / 10 : Math.round(percentual);
  if (arredondado === 0) return "0%";
  const sinal = arredondado > 0 ? "+" : MENOS;
  return `${sinal}${UMA_CASA.format(Math.abs(arredondado))}%`;
}

export function formatarParticipacao(razao: number): string {
  return `${INTEIRO.format(Math.round(razao * 100))}%`;
}

/** "2026-10-07" → "07/10/2026", sem passar por Date (evita deslocamento de fuso). */
export function formatarData(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** "2026-03" → "mar" */
export function formatarMesCurto(mesIso: string): string {
  return MESES_CURTOS[Number(mesIso.slice(5, 7)) - 1] ?? mesIso;
}

/** "2026-03" → "mar/26" */
export function formatarMesAno(mesIso: string): string {
  return `${formatarMesCurto(mesIso)}/${mesIso.slice(2, 4)}`;
}

/** "2026-04" a "2026-09" → "abr–set/26"; com anos diferentes, "nov/25–abr/26". */
export function formatarPeriodo(inicioIso: string, fimIso: string): string {
  const inicio = inicioIso.slice(0, 4) === fimIso.slice(0, 4) ? formatarMesCurto(inicioIso) : formatarMesAno(inicioIso);
  return `${inicio}–${formatarMesAno(fimIso)}`;
}

/** "2026-03" → "março" */
export function formatarNomeDoMes(mesIso: string): string {
  return MESES_LONGOS[Number(mesIso.slice(5, 7)) - 1] ?? mesIso;
}

/** "2026-03" → "março de 2026" */
export function formatarMesPorExtenso(mesIso: string): string {
  return `${formatarNomeDoMes(mesIso)} de ${mesIso.slice(0, 4)}`;
}

/** "2026-10-09" → "Sexta-feira, 9 de outubro" */
export function formatarDiaPorExtenso(dataIso: string): string {
  const texto = DIA_POR_EXTENSO.format(paraDiaUtc(dataIso));
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}`;
}

/** Tempo desde uma data, em linguagem de conversa: "hoje", "há 12 dias", "há 4 meses". */
export function formatarTempoDesde(dataIso: string, hojeIso: string): string {
  const dias = diasEntre(dataIso, hojeIso);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 60) return `há ${dias} dias`;
  if (dias < 365) return `há ${Math.round(dias / 30.4)} meses`;
  const anos = Math.floor(dias / 365);
  return anos === 1 ? "há mais de 1 ano" : `há mais de ${anos} anos`;
}

/** "Representante 1401", "Representantes 1118 e 1119". */
export function formatarCodigosDoRepresentante(codigos: string[]): string {
  const rotulo = codigos.length === 1 ? "Representante" : "Representantes";
  return `${rotulo} ${LISTA.format(codigos)}`;
}

/** "1 cliente", "9 clientes". */
export function formatarContagem(quantidade: number, singular: string, plural: string): string {
  return `${formatarNumero(quantidade)} ${quantidade === 1 ? singular : plural}`;
}

/** Para buscas: sem acento e em minúsculas ("Retífica" acha "retifica"). */
export function normalizarParaBusca(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Prazo até uma data futura: "hoje", "amanhã", "em 12 dias", "em 3 meses". */
export function formatarPrazo(dataIso: string, hojeIso: string): string {
  const dias = diasEntre(hojeIso, dataIso);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias < 60) return `em ${dias} dias`;
  return `em ${Math.round(dias / 30.4)} meses`;
}

/**
 * Data e hora ("2026-10-07T15:10") em relação ao relógio de Brasília, nunca à data da foto:
 * "hoje, 15:10", "ontem, 09:05", "07/10 às 15:10".
 */
export function formatarMomento(momentoIso: string, relogioIso: string): string {
  const data = dataDoMomento(momentoIso);
  const hora = horaDoMomento(momentoIso);
  const hojeIso = dataDoMomento(relogioIso);
  const dias = diasEntre(data, hojeIso);
  if (dias === 0) return `hoje, ${hora}`;
  if (dias === 1) return `ontem, ${hora}`;
  const diaEMes = formatarData(data).slice(0, 5);
  return data.slice(0, 4) === hojeIso.slice(0, 4) ? `${diaEMes} às ${hora}` : `${formatarData(data)} às ${hora}`;
}

export function diasEntre(deIso: string, ateIso: string): number {
  return Math.round((paraDiaUtc(ateIso) - paraDiaUtc(deIso)) / 86_400_000);
}

function paraDiaUtc(dataIso: string): number {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  return Date.UTC(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1);
}
