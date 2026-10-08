import { diasEntre } from "../formato";
import type { Situacao } from "./tipos";

/*
 * Regras das análises (docs/plano.md, "Regras de negócio"). Na F1 alimentam os dados fictícios;
 * na F2 o extrator calcula o mesmo com os dados do ERP.
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

const DIAS_PARA_INATIVO = 730;
const DIAS_DE_CLIENTE_NOVO = 365;
const INTERVALO_PARA_REATIVADO = 365;
const BASE_MINIMA_DO_SEMESTRE = 3_000;
const DIFERENCA_MINIMA = 2_000;
const VARIACAO_MINIMA = 0.2;
/** No protótipo, cada mês com compra conta como uma compra. */
const COMPRAS_MINIMAS = 3;

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

/**
 * Comprando menos ou mais: últimos 6 meses fechados contra os mesmos 6 do ano anterior. Exige base
 * de R$ 3 mil, 3 compras nos dois períodos, variação de 20% e diferença de R$ 2 mil.
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
  const pecas = somar(atual.map((mes) => mes.pecas));
  const pecasAnoAnterior = somar(anterior.map((mes) => mes.pecas));
  return {
    direcao: variacao < 0 ? "menos" : "mais",
    semestre,
    semestreAnoAnterior,
    variacao,
    variacaoPecas: pecasAnoAnterior > 0 ? pecas / pecasAnoAnterior - 1 : null,
  };
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
