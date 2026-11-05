/*
 * O que cada tela consome, venha dos dados fictícios (ficticio.ts) ou do servidor (fonteDoServidor.ts),
 * sempre com estes mesmos formatos.
 * Datas são texto ISO ("2026-10-07") e meses "2026-10".
 */

import type { Projecao } from "dominio/projecao";
import type { Mercado, OportunidadeMix, Porte, PrecisaoDoPonto, Situacao, StatusDoCadastro } from "dominio/tipos";

export type { Mercado, OportunidadeMix, Porte, Situacao, StatusDoCadastro };

/** Meses "2026-04" a "2026-09": os 6 fechados que as análises de ritmo comparam com os mesmos do ano anterior. */
export type Semestre = { inicio: string; fim: string };

export type SituacaoDosDados = {
  /** Início da leitura do ERP que gerou a foto ("2026-10-09T07:02"). */
  atualizadoEm: string;
  /** Data da foto: a referência das regras e das datas que vêm do ERP. */
  hoje: string;
  /** O semestre de "comprando menos" e "comprando mais", que explica o selo "Em risco". */
  semestre: Semestre;
  /**
   * Relógio do servidor em Brasília ("2026-10-09T09:15"). Vale para o "hoje" da barra, a entrega
   * mínima, a data e a saudação do Início e os momentos que o próprio CRM grava. Com a foto
   * atrasada, a data dele fica à frente de `hoje`.
   */
  relogio: string;
  /**
   * O login da sessão. Ele pode ter mais de um código de representante (a mesma representação com
   * dois números), e as telas somam todos.
   */
  representante: { nome: string; codigos: string[] };
};

/**
 * Um cliente da carteira, ou um grupo do SGI: dois ou mais CNPJs do mesmo grupo na carteira do
 * mesmo representante, mostrados como um cliente só, com os números deles somados.
 */
export type ClienteResumo = {
  /** Identificador do cliente no CRM: endereço da ficha e rascunhos. Não aparece na tela. */
  codigo: string;
  /** Código do cliente no ERP, para mostrar e buscar. Nulo na pessoa física, em que ele é o CPF, e no grupo. */
  codigoErp: string | null;
  nome: string;
  cidade: string;
  uf: string;
  /** Código IBGE de 7 dígitos do município, o que liga o cliente ao mapa; null quando o cadastro não tem. */
  municipio: string | null;
  /** Só na empresa, que tem o endereço público no CNPJ. Null na pessoa física e no grupo. */
  endereco: EnderecoDoCliente | null;
  mercado: Mercado;
  situacao: Situacao;
  /** Fora de ativo no cadastro do SGI, o cliente aparece com o status e não recebe pedido. */
  status: StatusDoCadastro;
  ultimaCompra: string | null;
  /** Ciclo típico de compra em dias; null para cliente irregular. */
  cicloDias: number | null;
  /** Soma dos últimos 12 meses fechados. */
  faturamento12m: number;
  /** Variação contra os 12 meses anteriores; null quando a base é pequena demais. */
  variacao12m: number | null;
  /**
   * Só no cliente em risco: a variação do semestre contra o mesmo do ano anterior, que o pôs em
   * risco (ver Análises, "Comprando menos"). Ela pode ser negativa com `variacao12m` positiva.
   */
  quedaNoSemestre: number | null;
  /**
   * O faturado em 12 meses recalculado no fim de cada mês fechado, de um ano atrás até o último
   * (13 pontos, do mais antigo ao mais recente). O primeiro é a base da variação e o último é
   * `faturamento12m`; assim variação = último ÷ primeiro − 1. Por somar 12 meses, não tem o
   * zigue-zague de quem compra a cada 2 ou 3 meses.
   */
  evolucao12m: number[];
  /**
   * No grupo: os CNPJs dele, do que mais fatura ao que menos, cada um com os próprios números. O
   * grupo não tem cidade, município nem código do ERP: o mapa e o pedido usam os CNPJs. Null no
   * cliente sozinho e no próprio CNPJ.
   */
  cnpjs: ClienteResumo[] | null;
};

export type EnderecoDoCliente = {
  /** Como está no cadastro do ERP: a rua, o número e o complemento num texto só. */
  texto: string;
  bairro: string | null;
  /** 8 dígitos. */
  cep: string | null;
  /** O ponto do endereço pelo Cadastro de Endereços do IBGE (CNEFE); null quando a busca não achou. */
  ponto: PontoDoEndereco | null;
};

export type PontoDoEndereco = { latitude: number; longitude: number; precisao: PrecisaoDoPonto };

export type FaturamentoMensal = {
  mes: string;
  valor: number;
};

export type FamiliaComprada = {
  familia: string;
  valor: number;
  participacao: number;
  /** Peças nos mesmos 12 meses, com o cento já em peças. */
  pecas: number;
};

export type ProdutoComprado = {
  codigo: string;
  familia: string;
  pecas: number;
  valor: number;
  ultimaCompra: string;
};

export type PedidoEmAberto = {
  numero: string;
  emissao: string;
  entrega: string;
  itens: number;
  valor: number;
};

/** Onde o pedido está hoje: as abas de Pedidos, uma por status. */
export type StatusDoPedido = "faturado" | "em_aberto" | "enviado" | "rascunho";

/** Uma linha do histórico de pedidos da ficha, venha do ERP ou do CRM. */
export type PedidoDaFicha = {
  /** Identifica a linha; não aparece na tela. */
  id: string;
  /** Na ficha do grupo, o CNPJ do pedido; null na ficha de um cliente. */
  cnpj: { codigo: string; nome: string } | null;
  /** O número do ERP ou, até o pedido chegar lá, o do CRM ("CRM-00106"); null no rascunho. */
  numero: string | null;
  status: StatusDoPedido;
  /** A emissão no ERP; no CRM, o envio ou o último salvamento do rascunho. */
  emissao: string;
  /** Faturado: a última nota. Em aberto: a entrega mais próxima. No CRM: a entrega pedida, se houver. */
  entrega: string | null;
  /** O que a linha mostra ao abrir, na ordem do pedido. No faturado, um por produto, com as notas do período somadas. */
  itens: ItemDaFicha[];
  /** Faturado: as notas do pedido no período. Em aberto: o saldo. No CRM: o total do SGI ou o estimado. */
  valor: number;
};

/** Item de um pedido da ficha; a entrega só no pedido em aberto. */
export type ItemDaFicha = ItemDoErp & { entrega: string | null };

export type FichaCliente = ClienteResumo & {
  razaoSocial: string;
  /** Só o ano da primeira compra (a data completa fica na LAN); null para quem nunca comprou. */
  clienteDesde: number | null;
  /**
   * Os 60 meses fechados e o corrente, parcial. A tendência soma os 12 meses até cada um dos últimos
   * 48, e a soma do primeiro usa os 11 anteriores. Na carteira fictícia, são 36.
   */
  mensal: FaturamentoMensal[];
  familias: FamiliaComprada[];
  produtos: ProdutoComprado[];
  oportunidades: OportunidadeMix[];
  /**
   * Com quem o mix foi comparado: clientes ativos de toda a Suprens, do mercado do cliente, na
   * mesma faixa de porte (porte null = o mercado inteiro). null quando nem o mercado tem 20.
   */
  grupoDoMix: { porte: Porte | null } | null;
  /** Os pedidos dos últimos 12 meses e do mês corrente, e os em aberto de qualquer data; no grupo, os de todos os CNPJs. */
  pedidos: PedidoDaFicha[];
  /** No CNPJ de um grupo: o grupo, para voltar à ficha dele. */
  grupo: { codigo: string; nome: string } | null;
  /** Os dias em que o login visitou o cliente (no grupo, algum CNPJ dele), do mais recente ao mais antigo, até 10 (app.db). */
  visitas: string[];
};

/** A última visita do login a cada cliente que ele visitou, pelo código do cliente (app.db). */
export type UltimasVisitas = Record<string, string>;

export type MesDoPainel = {
  mes: string;
  /** null para meses que ainda não chegaram. */
  faturado: number | null;
  anoAnterior: number;
  /**
   * Só no mês corrente, inclusive 0: pedidos em aberto com entrega até o fim do mês. null nos
   * outros meses; é por ele que a tela reconhece o mês corrente.
   */
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
  semestre: Semestre;
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
    /** Pedidos em carteira com entrega até o fim do mês. */
    aFaturarNoMes: number;
    /** Faturado mais o ritmo dos últimos 6 meses nos dias úteis que faltam (dominio/projecao.ts). */
    projecao: Projecao;
    diaUtil: number;
    diasUteis: number;
  };
  ano: {
    acumulado: number;
    acumuladoAnoAnterior: number;
  };
  pedidosEmAberto: { quantidade: number; valor: number };
  mensal: MesDoPainel[];
  /**
   * O faturado de cada mês fechado, do mais antigo ao mais recente, na visão do representante: a
   * tendência do Início soma 12 meses até cada um dos últimos 48, como a da ficha. São 60 meses; na
   * carteira fictícia, 36.
   */
  historico: FaturamentoMensal[];
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
  /** Faixa de aperto ("14–22 mm"); null nas famílias sem ela, como kits e molas. */
  medida: string | null;
  /** Peças por embalagem: o pedido anda de embalagem em embalagem. */
  embalagem: number;
  /**
   * Preço do cento (100 peças) na tabela do cliente, com o desconto da família (o do modelo do produto)
   * ou, sem ele, o desconto padrão do cliente. É o menor preço que o pedido aceita.
   */
  precoDaTabela: number;
  /** A última compra do produto nos 24 meses: o preço do cento na nota e o dia. Null se o cliente não comprou. */
  ultimaCompra: { precoCento: number; data: string } | null;
  /**
   * Os part numbers da Bíblia Montadora: os códigos que as montadoras dão ao produto, só dos itens
   * ativos. Vazio quando nenhuma montadora tem o produto.
   */
  partNumbers: string[];
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
  /** O preço do cento que vai no pedido: o da última compra ou o que o representante pôs, nunca abaixo da tabela. */
  precoCento: number;
};

/** O que a tela manda para salvar: o representante vem sempre da sessão. */
export type RascunhoParaSalvar = {
  /** Gerado na tela (UUID) quando o pedido começa: salvar de novo, até ao fechar a página, não duplica o rascunho. */
  id: string;
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
  medida: string | null;
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

/** Uma linha de pedido ou de nota do ERP: produto, quantidade e valor. */
export type ItemDoErp = {
  /** Posição no pedido ou na nota: o mesmo produto pode vir em duas linhas. Não aparece na tela. */
  ordem: number;
  codigo: string;
  familia: string;
  pecas: number;
  /** Sem IPI; no pedido, o saldo × preço com os descontos. */
  valor: number;
};

/** Item com saldo de um pedido do ERP: o que ainda falta faturar. */
export type ItemEmAberto = ItemDoErp & { entrega: string };

export type PedidoNoErp = PedidoEmAberto & {
  cliente: ClienteResumo;
  /** O que a linha mostra ao abrir: os itens com saldo, na ordem do pedido. */
  itensEmAberto: ItemEmAberto[];
};

export type NotaFaturada = {
  /** Série e número: o número sozinho se repete entre séries. Nenhuma tela mostra a série. */
  id: string;
  numero: string;
  emissao: string;
  cliente: ClienteResumo;
  valor: number;
  /** Os pedidos do ERP de onde a nota saiu; vazio na nota sem pedido. */
  pedidos: string[];
  /** O que a linha mostra ao abrir, na ordem da nota. */
  itens: ItemDoErp[];
};

export type PainelDePedidos = {
  enviados: PedidoEnviado[];
  rascunhos: Rascunho[];
  emAberto: PedidoNoErp[];
  faturados: NotaFaturada[];
};
