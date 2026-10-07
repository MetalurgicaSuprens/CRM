/*
 * O que cada tela consome. Na F1 vem de dados fictícios (ficticio.ts);
 * a partir da F3, da API, com estes mesmos formatos.
 * Datas são texto ISO ("2026-10-07") e meses "2026-10".
 */

export type Situacao = "ativo" | "em_risco" | "parado" | "novo";

export type Mercado = "PRACA" | "MONTADORA" | "EXPORTACAO";

export type SituacaoDosDados = {
  atualizadoEm: string;
  hoje: string;
  representante: { codigo: string; nome: string };
};

export type ClienteResumo = {
  codigo: string;
  nome: string;
  cidade: string;
  uf: string;
  mercado: Mercado;
  situacao: Situacao;
  ultimaCompra: string | null;
  faturamento12m: number;
  /** Variação contra os 12 meses anteriores; null quando a base é pequena demais. */
  variacao12m: number | null;
  /**
   * Faturamento móvel de 6 meses em cada um dos últimos 12 meses fechados (do mais antigo ao
   * mais recente): mostra a direção sem o zigue-zague de quem compra a cada 2 ou 3 meses.
   */
  tendencia12m: number[];
};

export type FaturamentoMensal = {
  mes: string;
  valor: number;
  pecas: number;
};

export type FamiliaComprada = {
  familia: string;
  valor: number;
  participacao: number;
};

export type ProdutoComprado = {
  codigo: string;
  familia: string;
  pecas: number;
  valor: number;
  ultimaCompra: string;
};

export type OportunidadeMix = {
  familia: string;
  /** Parcela dos clientes do mesmo segmento que compram a família. */
  penetracao: number;
};

export type PedidoEmAberto = {
  numero: string;
  emissao: string;
  entrega: string;
  itens: number;
  valor: number;
};

export type FichaCliente = ClienteResumo & {
  razaoSocial: string;
  primeiraCompra: string;
  /** Ciclo típico de compra em dias; null para cliente irregular. */
  cicloDias: number | null;
  /** Últimos 24 meses fechados, mais o mês corrente parcial. */
  mensal: FaturamentoMensal[];
  familias: FamiliaComprada[];
  produtos: ProdutoComprado[];
  oportunidades: OportunidadeMix[];
  pedidosEmAberto: PedidoEmAberto[];
};

export type MesDoPainel = {
  mes: string;
  /** null para meses que ainda não chegaram. */
  faturado: number | null;
  anoAnterior: number;
  /** Só no mês corrente: pedidos em aberto com entrega até o fim do mês. */
  aFaturar: number | null;
};

export type DestaqueCliente = {
  cliente: ClienteResumo;
  /** Parou: faturamento mensal médio perdido. Menos/mais: diferença em R$ no semestre. Novo: faturamento desde a 1ª compra. */
  valor: number;
  variacao: number | null;
};

export type GrupoDestaque = {
  quantidade: number;
  /** Soma de `valor` de todos os clientes do grupo, não só dos listados. */
  valorTotal: number;
  itens: DestaqueCliente[];
};

export type PainelInicio = {
  mesAtual: {
    mes: string;
    faturado: number;
    anoAnteriorMesmoDiaUtil: number;
    aFaturarNoMes: number;
    diaUtil: number;
    diasUteis: number;
  };
  ano: {
    acumulado: number;
    acumuladoAnoAnterior: number;
  };
  pedidosEmAberto: { quantidade: number; valor: number };
  mensal: MesDoPainel[];
  destaques: {
    pararam: GrupoDestaque;
    menos: GrupoDestaque;
    mais: GrupoDestaque;
    novos: GrupoDestaque;
  };
};
