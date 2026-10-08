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

// ---------------------------------------------------------------- pedidos

export type ProdutoDoCatalogo = {
  codigo: string;
  familia: string;
  medida: string;
  /** Peças por embalagem: o pedido anda de embalagem em embalagem. */
  embalagem: number;
  /** Preço do cento (100 peças) na tabela do cliente; só referência, o SGI recalcula. */
  precoCento: number;
  /** Código que o próprio cliente usa para o produto, quando ele tem. */
  codigoNoCliente: string | null;
  jaComprou: boolean;
};

export type CatalogoDoCliente = {
  cliente: ClienteResumo;
  /** Nome da tabela de preço do cliente no SGI (a tabela vem do cliente, nunca do navegador). */
  tabela: string;
  produtos: ProdutoDoCatalogo[];
};

export type ItemDoPedido = {
  codigo: string;
  /** Em peças. */
  quantidade: number;
};

/** O que a tela manda para salvar: o representante vem sempre da sessão. */
export type RascunhoParaSalvar = {
  id: string | null;
  codigoCliente: string;
  itens: ItemDoPedido[];
  entrega: string | null;
  observacao: string;
};

export type Rascunho = {
  id: string;
  cliente: ClienteResumo;
  itens: ItemDoPedido[];
  entrega: string | null;
  observacao: string;
  /** "2026-10-08T16:42" */
  atualizadoEm: string;
  totalEstimado: number;
};

/**
 * "enviado" é a última etapa que o CRM controla; as outras voltam do ERP pela foto, ligadas
 * pelo número CRM.
 */
export type EtapaDoPedido =
  | "enviado"
  | "recebido"
  | "recusado"
  | "em_aprovacao"
  | "aprovado"
  | "no_erp"
  | "faturado_parcial"
  | "faturado"
  | "cancelado";

export type ItemEnviado = ItemDoPedido & {
  familia: string;
  medida: string;
  precoCento: number;
};

export type PedidoEnviado = {
  /** "CRM-00106" */
  numero: string;
  cliente: ClienteResumo;
  enviadoEm: string;
  entrega: string | null;
  observacao: string;
  itens: ItemEnviado[];
  totalEstimado: number;
  /** Total recalculado pelo SGI pela tabela do cliente; null até ele calcular. */
  totalSgi: number | null;
  numeroSgi: string | null;
  /** Número do pedido no ERP (Omega), depois de aprovado. */
  numeroErp: string | null;
  etapa: EtapaDoPedido;
  motivoRecusa: string | null;
  /** Quando o pedido chegou a cada etapa, em ordem. */
  historico: { etapa: EtapaDoPedido; em: string }[];
};

export type PedidoNoErp = PedidoEmAberto & { cliente: ClienteResumo };

export type NotaFaturada = {
  numero: string;
  emissao: string;
  cliente: ClienteResumo;
  valor: number;
};

export type PainelDePedidos = {
  enviados: PedidoEnviado[];
  rascunhos: Rascunho[];
  emAberto: PedidoNoErp[];
  faturados: NotaFaturada[];
};
