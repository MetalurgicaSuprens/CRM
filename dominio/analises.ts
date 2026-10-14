import { diasEntre, somarMeses } from "./datas.ts";
import type { Situacao } from "./tipos.ts";

/*
 * Regras das análises (docs/plano.md, "Regras de negócio"). O extrator as aplica aos dados do
 * ERP; o protótipo, aos fictícios.
 */

/** O que as análises precisam saber de cada cliente. */
export type HistoricoDoCliente = {
  /** Meses fechados, do mais antigo ao mais recente (o último é o mês passado); pelo menos 18. */
  mensal: readonly { valor: number; pecas: number }[];
  /** Datas das compras, da mais antiga à mais recente. */
  compras: readonly string[];
  primeiraCompra: string;
  /** Ciclo típico em dias; null para o cliente irregular. */
  cicloDias: number | null;
  temPedidoEmAberto: boolean;
};

export type MudancaDeRitmo = {
  direcao: "menos" | "mais";
  semestre: number;
  semestreAnoAnterior: number;
  variacao: number;
  /** Variação em peças: mostra quanto da variação em R$ é só reajuste de preço. */
  variacaoPecas: number | null;
};

export type EntradaRecente = { tipo: "novo" | "reativado"; desde: string };

/** A situação do cliente e as listas das análises em que ele entra. */
export type AnaliseDoCliente = {
  situacao: Situacao;
  /** "Pararam de comprar". */
  parada: { diasSemComprar: number; perdaMensal: number } | null;
  /** "Comprando menos" (só quem está em risco) ou "Comprando mais" (menos o cliente novo). */
  ritmo: MudancaDeRitmo | null;
  /** "Novos e reativados". */
  entrada: EntradaRecente | null;
  /** Fora de parado e inativo: pode receber sugestão de mix. */
  isAtivo: boolean;
};

const DIAS_PARA_INATIVO = 730;
const DIAS_DE_CLIENTE_NOVO = 365;
const INTERVALO_PARA_REATIVADO = 365;
const BASE_MINIMA_DO_SEMESTRE = 3_000;
const DIFERENCA_MINIMA = 2_000;
const VARIACAO_MINIMA = 0.2;
/** No protótipo, cada mês com compra conta como uma compra. */
const COMPRAS_MINIMAS = 3;

export function analisarCliente(cliente: HistoricoDoCliente, hoje: string): AnaliseDoCliente {
  const situacao = classificarSituacao(cliente, hoje);
  const isAtivo = situacao !== "parado" && situacao !== "inativo";
  return {
    situacao,
    parada: parouDeComprar(cliente, hoje)
      ? { diasSemComprar: diasSemComprar(cliente, hoje) ?? 0, perdaMensal: perdaMensal(cliente) }
      : null,
    ritmo: isAtivo ? ritmoDasListas(mudancaDeRitmo(cliente), situacao) : null,
    entrada: isAtivo ? entradaRecente(cliente, hoje) : null,
    isAtivo,
  };
}

function ritmoDasListas(ritmo: MudancaDeRitmo | null, situacao: Situacao): MudancaDeRitmo | null {
  if (ritmo?.direcao === "menos") return situacao === "em_risco" ? ritmo : null;
  if (ritmo?.direcao === "mais") return situacao === "novo" ? null : ritmo;
  return null;
}

export function classificarSituacao(cliente: HistoricoDoCliente, hoje: string): Situacao {
  const dias = diasSemComprar(cliente, hoje);
  if (dias === null || dias > DIAS_PARA_INATIVO) return "inativo";
  if (parouDeComprar(cliente, hoje)) return "parado";
  if (entradaRecente(cliente, hoje)?.tipo === "novo") return "novo";
  if (mudancaDeRitmo(cliente)?.direcao === "menos") return "em_risco";
  return "ativo";
}

export function diasSemComprar(cliente: HistoricoDoCliente, hoje: string): number | null {
  const ultima = cliente.compras.at(-1);
  return ultima ? diasEntre(ultima, hoje) : null;
}

/** O maior entre 60 dias e 2× o ciclo; 180 dias para o cliente irregular. */
export function limiteSemComprar(cicloDias: number | null): number {
  return cicloDias === null ? 180 : Math.max(60, 2 * cicloDias);
}

/** Passou do limite sem comprar, não tem pedido em aberto e ainda não virou inativo (24 meses). */
export function parouDeComprar(cliente: HistoricoDoCliente, hoje: string): boolean {
  const dias = diasSemComprar(cliente, hoje);
  if (dias === null || cliente.temPedidoEmAberto) return false;
  return dias > limiteSemComprar(cliente.cicloDias) && dias <= DIAS_PARA_INATIVO;
}

/** Média mensal dos 12 meses até a última compra: o que deixou de entrar por mês. */
export function perdaMensal(cliente: HistoricoDoCliente): number {
  const ultimoComCompra = cliente.mensal.findLastIndex((mes) => mes.valor > 0);
  if (ultimoComCompra < 0) return 0;
  const doze = cliente.mensal.slice(Math.max(0, ultimoComCompra - 11), ultimoComCompra + 1);
  return Math.round(somar(doze.map((mes) => mes.valor)) / 12);
}

/** Os 6 meses fechados que "comprando menos ou mais" compara: do 6º antes do mês corrente ao mês passado. */
export function semestreDoRitmo(mesAtual: string): { inicio: string; fim: string } {
  return { inicio: somarMeses(mesAtual, -6), fim: somarMeses(mesAtual, -1) };
}

/**
 * Comprando menos ou mais: últimos 6 meses fechados contra os mesmos 6 do ano anterior. Exige base
 * de R$ 3 mil, 3 compras nos dois períodos, variação de 20% e diferença de R$ 2 mil. A mudança ainda
 * precisa continuar no último trimestre (decidido pelo Lucas em 2026-10-14): quem já voltou ao ritmo
 * do ano anterior não entra na lista por uma pausa ou por um pico que passou.
 */
export function mudancaDeRitmo(cliente: HistoricoDoCliente): MudancaDeRitmo | null {
  const total = cliente.mensal.length;
  const atual = cliente.mensal.slice(total - 6);
  const anterior = cliente.mensal.slice(total - 18, total - 12);
  const semestre = somar(atual.map((mes) => mes.valor));
  const semestreAnoAnterior = somar(anterior.map((mes) => mes.valor));
  const compras = [...atual, ...anterior].filter((mes) => mes.valor > 0).length;
  if (semestreAnoAnterior < BASE_MINIMA_DO_SEMESTRE || compras < COMPRAS_MINIMAS) return null;
  const variacao = semestre / semestreAnoAnterior - 1;
  if (Math.abs(variacao) < VARIACAO_MINIMA || Math.abs(semestre - semestreAnoAnterior) < DIFERENCA_MINIMA) return null;
  const direcao = variacao < 0 ? "menos" : "mais";
  if (!continuaNoTrimestre(cliente, direcao)) return null;
  const pecas = somar(atual.map((mes) => mes.pecas));
  const pecasAnoAnterior = somar(anterior.map((mes) => mes.pecas));
  return {
    direcao,
    semestre,
    semestreAnoAnterior,
    variacao,
    variacaoPecas: pecasAnoAnterior > 0 ? pecas / pecasAnoAnterior - 1 : null,
  };
}

/** Os 3 últimos meses fechados vão para o mesmo lado do semestre, contra os mesmos 3 do ano anterior. */
function continuaNoTrimestre(cliente: HistoricoDoCliente, direcao: MudancaDeRitmo["direcao"]): boolean {
  const total = cliente.mensal.length;
  const trimestre = somar(cliente.mensal.slice(total - 3).map((mes) => mes.valor));
  const trimestreAnoAnterior = somar(cliente.mensal.slice(total - 15, total - 12).map((mes) => mes.valor));
  return direcao === "menos" ? trimestre < trimestreAnoAnterior : trimestre > trimestreAnoAnterior;
}

/**
 * Novo: primeira compra da história nos últimos 12 meses. Reativado: voltou a comprar nos
 * últimos 12 meses depois de 12 meses ou mais sem comprar.
 */
export function entradaRecente(cliente: HistoricoDoCliente, hoje: string): EntradaRecente | null {
  if (diasEntre(cliente.primeiraCompra, hoje) <= DIAS_DE_CLIENTE_NOVO) return { tipo: "novo", desde: cliente.primeiraCompra };
  for (let i = cliente.compras.length - 1; i > 0; i--) {
    const compra = cliente.compras[i];
    const anterior = cliente.compras[i - 1];
    if (!compra || !anterior || diasEntre(compra, hoje) > DIAS_DE_CLIENTE_NOVO) break;
    if (diasEntre(anterior, compra) >= INTERVALO_PARA_REATIVADO) return { tipo: "reativado", desde: compra };
  }
  return null;
}

function somar(valores: number[]): number {
  return valores.reduce((soma, valor) => soma + valor, 0);
}
