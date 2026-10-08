/*
 * O que cada tela consome. Na F1 vem de dados fictícios (ficticio.ts);
 * a partir da F3, da API, com estes mesmos formatos.
 * Datas são texto ISO ("2026-10-07") e meses "2026-10".
 */

/** "inativo": 24 meses ou mais sem comprar. */
export type Situacao = "ativo" | "em_risco" | "parado" | "novo" | "inativo";

export type Mercado = "PRACA" | "MONTADORA" | "EXPORTACAO";

/** Tercil do faturado em 12 meses dentro do mercado. */
export type Porte = "pequeno" | "medio" | "grande";

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
  /** Soma dos últimos 12 meses fechados. */
  faturamento12m: number;
  /** Variação contra os 12 meses anteriores; null quando a base é pequena demais. */
  variacao12m: number | null;
  /**
   * O faturado em 12 meses recalculado no fim de cada mês fechado, de um ano atrás até o último
   * (13 pontos, do mais antigo ao mais recente). O primeiro é a base da variação e o último é
   * `faturamento12m`; assim variação = último ÷ primeiro − 1. Por somar 12 meses, não tem o
   * zigue-zague de quem compra a cada 2 ou 3 meses.
   */
  evolucao12m: number[];
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
  /**
   * Com quem o mix foi comparado: clientes ativos de toda a Suprens, do mercado do cliente, na
   * mesma faixa de porte (porte null = o mercado inteiro). null quando nem o mercado tem 20.
   */
  grupoDoMix: { porte: Porte | null } | null;
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
  /** Parou: faturamento mensal médio perdido. Menos/mais: diferença em R$ no semestre. Novo ou reativado: faturado desde que chegou. */
  valor: number;
  variacao: number | null;
};

export type GrupoDestaque = {
  quantidade: number;
  /** Soma de `valor` de todos os clientes do grupo, não só dos listados. */
  valorTotal: number;
  itens: DestaqueCliente[];
};

export type ClienteParado = {
  cliente: ClienteResumo;
  diasSemComprar: number;
  cicloDias: number | null;
  /** Média mensal dos 12 meses até a última compra: o que deixou de entrar por mês. */
  perdaMensal: number;
};

export type ClienteComVariacao = {
  cliente: ClienteResumo;
  semestre: number;
  semestreAnoAnterior: number;
  variacao: number;
  /** Variação em peças: separa o volume do reajuste de preço. */
  variacaoPecas: number | null;
};

export type ClienteNovoOuReativado = {
  cliente: ClienteResumo;
  tipo: "novo" | "reativado";
  /** Primeira compra (novo) ou a compra da volta (reativado). */
  desde: string;
  faturadoDesde: number;
};

export type ClienteComMix = {
  cliente: ClienteResumo;
  porte: Porte | null;
  oportunidades: OportunidadeMix[];
};

/** As listas da tela de análises, já ordenadas pela regra de cada uma. */
export type Analises = {
  /** Meses de "comprando menos/mais": os 6 últimos fechados e os mesmos do ano anterior. */
  semestre: { inicio: string; fim: string };
  pararam: ClienteParado[];
  menos: ClienteComVariacao[];
  mais: ClienteComVariacao[];
  novos: ClienteNovoOuReativado[];
  mix: ClienteComMix[];
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
